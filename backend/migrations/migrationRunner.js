/**
 * Database Migration System
 * 
 * Provides a robust migration system for database schema management.
 * Ensures consistent schema across environments with rollback support.
 * 
 * @module migrations/migrationRunner
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname);

/**
 * Initialize migrations tracking table
 */
async function initMigrationsTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            batch INT NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Get list of executed migrations
 * @returns {Promise<string[]>} List of executed migration names
 */
async function getExecutedMigrations() {
    try {
        const result = await db.query('SELECT name FROM migrations ORDER BY id');
        return result.map(row => row.name);
    } catch (error) {
        return [];
    }
}

/**
 * Get current batch number
 * @returns {Promise<number>} Current batch number
 */
async function getCurrentBatch() {
    try {
        const result = await db.getOne('SELECT MAX(batch) as batch FROM migrations');
        return (result?.batch || 0) + 1;
    } catch (error) {
        return 1;
    }
}

/**
 * Get all migration files
 * @returns {string[]} List of migration file names
 */
function getMigrationFiles() {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.migration.js'))
        .sort();
}

/**
 * Run pending migrations
 */
async function runMigrations() {
    console.log('🔄 Running database migrations...\n');

    await initMigrationsTable();

    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();
    const pending = files.filter(f => !executed.includes(f));

    if (pending.length === 0) {
        console.log('✅ No pending migrations.\n');
        return;
    }

    const batch = await getCurrentBatch();

    for (const file of pending) {
        console.log(`  📦 Migrating: ${file}`);
        
        try {
            const migration = require(path.join(MIGRATIONS_DIR, file));
            
            if (typeof migration.up !== 'function') {
                throw new Error(`Migration ${file} does not export an 'up' function`);
            }

            await migration.up(db);
            
            await db.execute(
                'INSERT INTO migrations (name, batch) VALUES (?, ?)',
                [file, batch]
            );
            
            console.log(`     ✅ Completed\n`);
        } catch (error) {
            console.error(`     ❌ Failed: ${error.message}\n`);
            throw error;
        }
    }

    console.log(`✅ Migrations complete. Batch #${batch}\n`);
}

/**
 * Rollback last batch of migrations
 */
async function rollbackMigrations() {
    console.log('🔄 Rolling back last migration batch...\n');

    await initMigrationsTable();

    const currentBatch = await getCurrentBatch() - 1;
    if (currentBatch < 1) {
        console.log('✅ Nothing to rollback.\n');
        return;
    }

    const migrations = await db.query(
        'SELECT name FROM migrations WHERE batch = ? ORDER BY id DESC',
        [currentBatch]
    );

    for (const { name } of migrations) {
        console.log(`  📦 Rolling back: ${name}`);
        
        try {
            const migration = require(path.join(MIGRATIONS_DIR, name));
            
            if (typeof migration.down === 'function') {
                await migration.down(db);
            }
            
            await db.execute('DELETE FROM migrations WHERE name = ?', [name]);
            
            console.log(`     ✅ Rolled back\n`);
        } catch (error) {
            console.error(`     ❌ Failed: ${error.message}\n`);
            throw error;
        }
    }

    console.log('✅ Rollback complete.\n');
}

/**
 * Reset all migrations
 */
async function resetMigrations() {
    console.log('🔄 Resetting all migrations...\n');

    await initMigrationsTable();

    const migrations = await db.query(
        'SELECT name FROM migrations ORDER BY id DESC'
    );

    for (const { name } of migrations) {
        console.log(`  📦 Rolling back: ${name}`);
        
        try {
            const migration = require(path.join(MIGRATIONS_DIR, name));
            
            if (typeof migration.down === 'function') {
                await migration.down(db);
            }
            
            await db.execute('DELETE FROM migrations WHERE name = ?', [name]);
            
            console.log(`     ✅ Rolled back\n`);
        } catch (error) {
            console.error(`     ⚠️ Failed (continuing): ${error.message}\n`);
        }
    }

    console.log('✅ Reset complete.\n');
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
    await initMigrationsTable();

    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();

    console.log('\n📊 Migration Status:\n');
    console.log('  Status     | Migration');
    console.log('  -----------|------------------------------------------');

    for (const file of files) {
        const status = executed.includes(file) ? '✅ Run    ' : '⏳ Pending';
        console.log(`  ${status} | ${file}`);
    }

    console.log('');
}

// CLI interface
const command = process.argv[2];

if (require.main === module) {
    (async () => {
        try {
            switch (command) {
                case 'migrate':
                    await runMigrations();
                    break;
                case 'rollback':
                    await rollbackMigrations();
                    break;
                case 'reset':
                    await resetMigrations();
                    break;
                case 'status':
                    await getMigrationStatus();
                    break;
                default:
                    console.log('Usage: node migrationRunner.js [migrate|rollback|reset|status]');
            }
        } catch (error) {
            console.error('Migration error:', error.message);
            process.exit(1);
        } finally {
            await db.close();
        }
    })();
}

module.exports = {
    runMigrations,
    rollbackMigrations,
    resetMigrations,
    getMigrationStatus,
};
