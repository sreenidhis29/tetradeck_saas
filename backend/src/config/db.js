/**
 * Database Configuration Module
 * 
 * Provides a secure, configurable database connection pool
 * with automatic reconnection, health checks, and query logging.
 * 
 * @module config/db
 */

const mysql = require('mysql2');
const env = require('./environment');

// Database connection configuration
const dbConfig = {
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    waitForConnections: true,
    connectionLimit: env.database.connectionLimit,
    queueLimit: env.database.queueLimit,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Timezone configuration
    timezone: '+00:00',
    // Character set
    charset: 'utf8mb4',
};

// Add SSL configuration for production
if (env.database.ssl.enabled) {
    const fs = require('fs');
    dbConfig.ssl = {
        rejectUnauthorized: env.database.ssl.rejectUnauthorized,
    };
    if (env.database.ssl.caPath) {
        dbConfig.ssl.ca = fs.readFileSync(env.database.ssl.caPath);
    }
}

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Promise-based pool
const promisePool = pool.promise();

// Connection state tracking
let isConnected = false;
let lastHealthCheck = null;
let connectionRetries = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
    try {
        await promisePool.query('SELECT 1');
        isConnected = true;
        lastHealthCheck = new Date();
        connectionRetries = 0;
        return true;
    } catch (error) {
        isConnected = false;
        console.error('Database connection test failed:', error.message);
        return false;
    }
}

/**
 * Attempt to reconnect to database
 * @returns {Promise<boolean>} Reconnection status
 */
async function reconnect() {
    if (connectionRetries >= MAX_RETRIES) {
        console.error(`Database reconnection failed after ${MAX_RETRIES} attempts`);
        return false;
    }

    connectionRetries++;
    console.log(`Attempting database reconnection (${connectionRetries}/${MAX_RETRIES})...`);

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    return testConnection();
}

/**
 * Execute a query with automatic reconnection
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params) {
    try {
        const [results] = await promisePool.query(sql, params);
        return results;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') {
            const reconnected = await reconnect();
            if (reconnected) {
                const [results] = await promisePool.query(sql, params);
                return results;
            }
        }
        throw error;
    }
}

/**
 * Get a single result from a query
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} Single result or null
 */
async function getOne(sql, params) {
    const results = await query(sql, params);
    return results[0] || null;
}

/**
 * Execute a prepared statement
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Execution result with affectedRows, insertId, etc.
 */
async function execute(sql, params) {
    try {
        const [result] = await promisePool.execute(sql, params);
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') {
            const reconnected = await reconnect();
            if (reconnected) {
                const [result] = await promisePool.execute(sql, params);
                return result;
            }
        }
        throw error;
    }
}

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function receiving connection
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Get database health status
 * @returns {Promise<Object>} Health status object
 */
async function getHealth() {
    const status = {
        connected: false,
        lastCheck: lastHealthCheck,
        responseTime: null,
        poolInfo: {
            active: pool._allConnections?.length || 0,
            idle: pool._freeConnections?.length || 0,
            waiting: pool._connectionQueue?.length || 0,
        },
    };

    const startTime = Date.now();
    try {
        await promisePool.query('SELECT 1');
        status.connected = true;
        status.responseTime = Date.now() - startTime;
        lastHealthCheck = new Date();
    } catch (error) {
        status.error = error.message;
    }

    return status;
}

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
async function close() {
    return new Promise((resolve, reject) => {
        pool.end(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Initial connection test
testConnection().then(connected => {
    if (connected) {
        console.log('✅ Database connected successfully');
    } else {
        console.error('❌ Database connection failed - check configuration');
    }
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Database pool error:', err.message);
    isConnected = false;
});

module.exports = {
    query,
    getOne,
    execute,
    transaction,
    getHealth,
    testConnection,
    close,
    pool,
    promisePool,
};