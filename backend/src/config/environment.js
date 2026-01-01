/**
 * Environment Configuration Module
 * 
 * Centralizes all environment variable access with validation,
 * defaults, and type coercion. Never access process.env directly
 * in application code - always use this module.
 * 
 * @module config/environment
 */

const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Validates that required environment variables are set
 * @param {string[]} requiredVars - Array of required variable names
 * @throws {Error} If any required variables are missing
 */
function validateRequired(requiredVars) {
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

/**
 * Gets an environment variable with optional default
 * @param {string} key - Environment variable name
 * @param {*} defaultValue - Default value if not set
 * @returns {string} The environment variable value
 */
function get(key, defaultValue = undefined) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue === undefined) {
            console.warn(`Environment variable ${key} is not set and has no default`);
        }
        return defaultValue;
    }
    return value;
}

/**
 * Gets an environment variable as a boolean
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean} The parsed boolean value
 */
function getBool(key, defaultValue = false) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Gets an environment variable as an integer
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @returns {number} The parsed integer value
 */
function getInt(key, defaultValue = 0) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Gets an environment variable as a float
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @returns {number} The parsed float value
 */
function getFloat(key, defaultValue = 0.0) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Gets an environment variable as an array (comma-separated)
 * @param {string} key - Environment variable name
 * @param {string[]} defaultValue - Default value if not set
 * @returns {string[]} The parsed array value
 */
function getArray(key, defaultValue = []) {
    const value = process.env[key];
    if (value === undefined || value === '') return defaultValue;
    return value.split(',').map(s => s.trim()).filter(s => s);
}

// ============================================================
// ENVIRONMENT CONFIGURATION OBJECT
// ============================================================

const config = {
    // Node Environment
    nodeEnv: get('NODE_ENV', 'development'),
    isDevelopment: get('NODE_ENV', 'development') === 'development',
    isProduction: get('NODE_ENV', 'development') === 'production',
    isTest: get('NODE_ENV', 'development') === 'test',

    // Server
    server: {
        port: getInt('PORT', 5000),
        apiVersion: get('API_VERSION', 'v1'),
        corsOrigin: get('CORS_ORIGIN', '*'),
        corsCredentials: getBool('CORS_CREDENTIALS', true),
    },

    // Security
    security: {
        jwtSecret: get('JWT_SECRET', 'CHANGE_ME_IN_PRODUCTION'),
        jwtRefreshSecret: get('JWT_REFRESH_SECRET', 'CHANGE_ME_REFRESH_SECRET'),
        jwtAccessExpiry: get('JWT_ACCESS_EXPIRY', '15m'),
        jwtRefreshExpiry: get('JWT_REFRESH_EXPIRY', '7d'),
        sessionSecret: get('SESSION_SECRET', 'CHANGE_ME_SESSION_SECRET'),
        dataEncryptionKey: get('DATA_ENCRYPTION_KEY', ''),
        dataEncryptionAlgorithm: get('DATA_ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
    },

    // Password Policy
    passwordPolicy: {
        minLength: getInt('PASSWORD_MIN_LENGTH', 12),
        requireUppercase: getBool('PASSWORD_REQUIRE_UPPERCASE', true),
        requireNumber: getBool('PASSWORD_REQUIRE_NUMBER', true),
        requireSpecial: getBool('PASSWORD_REQUIRE_SPECIAL', true),
        maxLoginAttempts: getInt('MAX_LOGIN_ATTEMPTS', 5),
        lockoutDurationMinutes: getInt('LOCKOUT_DURATION_MINUTES', 30),
    },

    // Rate Limiting
    rateLimit: {
        windowMs: getInt('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
        maxRequests: getInt('RATE_LIMIT_MAX_REQUESTS', 100),
    },

    // Database
    database: {
        host: get('DB_HOST', 'localhost'),
        port: getInt('DB_PORT', 3306),
        user: get('DB_USER', 'root'),
        password: get('DB_PASSWORD', ''),
        name: get('DB_NAME', 'company'),
        connectionLimit: getInt('DB_CONNECTION_LIMIT', 10),
        queueLimit: getInt('DB_QUEUE_LIMIT', 0),
        ssl: {
            enabled: getBool('DB_SSL_ENABLED', false),
            caPath: get('DB_SSL_CA_PATH', ''),
            rejectUnauthorized: getBool('DB_SSL_REJECT_UNAUTHORIZED', true),
        },
    },

    // AI Services
    ai: {
        leaveUrl: get('LEAVE_AI_URL', 'http://localhost:8001'),
        onboardingUrl: get('ONBOARDING_AI_URL', 'http://localhost:8002'),
        performanceUrl: get('PERFORMANCE_AI_URL', 'http://localhost:8003'),
        recruitmentUrl: get('RECRUITMENT_AI_URL', 'http://localhost:8004'),
        openaiApiKey: get('OPENAI_API_KEY', ''),
        openaiModel: get('OPENAI_MODEL', 'gpt-4'),
    },

    // Google Integration
    google: {
        clientId: get('GOOGLE_CLIENT_ID', ''),
        clientSecret: get('GOOGLE_CLIENT_SECRET', ''),
        redirectUri: get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/google/callback'),
        calendarEnabled: getBool('GOOGLE_CALENDAR_ENABLED', false),
    },

    // Microsoft Integration
    microsoft: {
        clientId: get('MICROSOFT_CLIENT_ID', ''),
        clientSecret: get('MICROSOFT_CLIENT_SECRET', ''),
        tenantId: get('MICROSOFT_TENANT_ID', ''),
        redirectUri: get('MICROSOFT_REDIRECT_URI', 'http://localhost:5000/api/auth/microsoft/callback'),
    },

    // SSO Configuration
    sso: {
        samlEnabled: getBool('SAML_ENABLED', false),
        samlEntryPoint: get('SAML_ENTRY_POINT', ''),
        samlIssuer: get('SAML_ISSUER', ''),
        samlCertPath: get('SAML_CERT_PATH', ''),
        samlCallbackUrl: get('SAML_CALLBACK_URL', ''),
        oauth2Enabled: getBool('OAUTH2_ENABLED', false),
        oauth2AuthorizationUrl: get('OAUTH2_AUTHORIZATION_URL', ''),
        oauth2TokenUrl: get('OAUTH2_TOKEN_URL', ''),
        oauth2ClientId: get('OAUTH2_CLIENT_ID', ''),
        oauth2ClientSecret: get('OAUTH2_CLIENT_SECRET', ''),
    },

    // Two-Factor Authentication
    twoFactor: {
        enabled: getBool('TWO_FACTOR_ENABLED', false),
        issuer: get('TWO_FACTOR_ISSUER', 'CompanyHR'),
        algorithm: get('TWO_FACTOR_ALGORITHM', 'SHA1'),
        digits: getInt('TWO_FACTOR_DIGITS', 6),
        period: getInt('TWO_FACTOR_PERIOD', 30),
    },

    // Slack
    slack: {
        enabled: getBool('SLACK_ENABLED', false),
        botToken: get('SLACK_BOT_TOKEN', ''),
        signingSecret: get('SLACK_SIGNING_SECRET', ''),
        webhookUrl: get('SLACK_WEBHOOK_URL', ''),
        appId: get('SLACK_APP_ID', ''),
    },

    // Teams
    teams: {
        enabled: getBool('TEAMS_ENABLED', false),
        webhookUrl: get('TEAMS_WEBHOOK_URL', ''),
    },

    // Email
    email: {
        enabled: getBool('EMAIL_ENABLED', false),
        provider: get('EMAIL_PROVIDER', 'smtp'),
        smtp: {
            host: get('SMTP_HOST', 'smtp.gmail.com'),
            port: getInt('SMTP_PORT', 587),
            secure: getBool('SMTP_SECURE', false),
            user: get('SMTP_USER', ''),
            password: get('SMTP_PASSWORD', ''),
        },
        fromAddress: get('EMAIL_FROM_ADDRESS', 'noreply@company.com'),
        fromName: get('EMAIL_FROM_NAME', 'Company HR System'),
        sendgridApiKey: get('SENDGRID_API_KEY', ''),
        awsSes: {
            accessKey: get('AWS_SES_ACCESS_KEY', ''),
            secretKey: get('AWS_SES_SECRET_KEY', ''),
            region: get('AWS_SES_REGION', 'us-east-1'),
        },
    },

    // Payroll
    payroll: {
        enabled: getBool('PAYROLL_ENABLED', false),
        provider: get('PAYROLL_PROVIDER', 'custom'),
        apiUrl: get('PAYROLL_API_URL', ''),
        apiKey: get('PAYROLL_API_KEY', ''),
        clientId: get('PAYROLL_CLIENT_ID', ''),
        clientSecret: get('PAYROLL_CLIENT_SECRET', ''),
    },

    // HRIS
    hris: {
        enabled: getBool('HRIS_ENABLED', false),
        provider: get('HRIS_PROVIDER', 'custom'),
        apiUrl: get('HRIS_API_URL', ''),
        apiKey: get('HRIS_API_KEY', ''),
    },

    // Pusher (Real-time)
    pusher: {
        enabled: getBool('PUSHER_ENABLED', false),
        appId: get('PUSHER_APP_ID', ''),
        key: get('PUSHER_KEY', ''),
        secret: get('PUSHER_SECRET', ''),
        cluster: get('PUSHER_CLUSTER', 'us2'),
    },

    // Feature Flags
    features: {
        calendarSync: getBool('FEATURE_CALENDAR_SYNC', false),
        emailNotifications: getBool('FEATURE_EMAIL_NOTIFICATIONS', false),
        slackNotifications: getBool('FEATURE_SLACK_NOTIFICATIONS', false),
        teamsNotifications: getBool('FEATURE_TEAMS_NOTIFICATIONS', false),
        payrollSync: getBool('FEATURE_PAYROLL_SYNC', false),
        autoApproval: getBool('FEATURE_AUTO_APPROVAL', true),
        aiRecommendations: getBool('FEATURE_AI_RECOMMENDATIONS', true),
        twoFactorAuth: getBool('FEATURE_TWO_FACTOR_AUTH', false),
        sso: getBool('FEATURE_SSO', false),
        auditLog: getBool('FEATURE_AUDIT_LOG', true),
        dataExport: getBool('FEATURE_DATA_EXPORT', true),
    },

    // Compliance
    compliance: {
        auditLogEnabled: getBool('AUDIT_LOG_ENABLED', true),
        auditLogRetentionDays: getInt('AUDIT_LOG_RETENTION_DAYS', 2555),
        gdprEnabled: getBool('GDPR_ENABLED', true),
        dataRetentionDays: getInt('DATA_RETENTION_DAYS', 2555),
        piiEncryptionEnabled: getBool('PII_ENCRYPTION_ENABLED', true),
    },

    // Multi-tenancy
    multiTenant: {
        enabled: getBool('MULTI_TENANT_ENABLED', false),
        isolationMode: get('TENANT_ISOLATION_MODE', 'schema'),
        defaultTenantId: get('DEFAULT_TENANT_ID', 'default'),
    },

    // Logging
    logging: {
        level: get('LOG_LEVEL', 'info'),
        format: get('LOG_FORMAT', 'json'),
        filePath: get('LOG_FILE_PATH', './logs/app.log'),
        maxSize: get('LOG_MAX_SIZE', '10m'),
        maxFiles: getInt('LOG_MAX_FILES', 5),
    },

    // Health Check
    healthCheck: {
        enabled: getBool('HEALTH_CHECK_ENABLED', true),
        path: get('HEALTH_CHECK_PATH', '/api/health'),
    },

    // Metrics
    metrics: {
        enabled: getBool('METRICS_ENABLED', false),
        path: get('METRICS_PATH', '/metrics'),
        port: getInt('METRICS_PORT', 9090),
    },

    // Error Tracking
    sentry: {
        dsn: get('SENTRY_DSN', ''),
        environment: get('SENTRY_ENVIRONMENT', 'development'),
    },

    // Storage
    storage: {
        provider: get('STORAGE_PROVIDER', 'local'),
        localPath: get('STORAGE_LOCAL_PATH', './uploads'),
        s3: {
            bucket: get('AWS_S3_BUCKET', ''),
            region: get('AWS_S3_REGION', 'us-east-1'),
            accessKey: get('AWS_S3_ACCESS_KEY', ''),
            secretKey: get('AWS_S3_SECRET_KEY', ''),
        },
    },

    // Backup
    backup: {
        enabled: getBool('BACKUP_ENABLED', false),
        schedule: get('BACKUP_SCHEDULE', '0 2 * * *'),
        retentionDays: getInt('BACKUP_RETENTION_DAYS', 30),
        storagePath: get('BACKUP_STORAGE_PATH', './backups'),
        encryptionEnabled: getBool('BACKUP_ENCRYPTION_ENABLED', true),
    },

    // API Documentation
    swagger: {
        enabled: getBool('SWAGGER_ENABLED', true),
        path: get('SWAGGER_PATH', '/api/docs'),
        authRequired: getBool('API_DOCS_AUTH_REQUIRED', false),
    },

    // Redis
    redis: {
        enabled: getBool('REDIS_ENABLED', false),
        host: get('REDIS_HOST', 'localhost'),
        port: getInt('REDIS_PORT', 6379),
        password: get('REDIS_PASSWORD', ''),
        db: getInt('REDIS_DB', 0),
    },

    // Webhooks
    webhooks: {
        secret: get('WEBHOOK_SECRET', 'CHANGE_ME_WEBHOOK_SECRET'),
        retryCount: getInt('WEBHOOK_RETRY_COUNT', 3),
        timeoutMs: getInt('WEBHOOK_TIMEOUT_MS', 30000),
    },
};

// Validate critical environment variables in production
if (config.isProduction) {
    const criticalVars = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
        'DATA_ENCRYPTION_KEY',
    ];

    // Check for default/weak values
    const weakValues = [
        'CHANGE_ME_IN_PRODUCTION',
        'CHANGE_ME_REFRESH_SECRET',
        'CHANGE_ME_SESSION_SECRET',
        'secret_key_change_me',
    ];

    criticalVars.forEach(varName => {
        const value = process.env[varName];
        if (!value || weakValues.some(weak => value.includes(weak))) {
            console.error(`⚠️  SECURITY WARNING: ${varName} is not properly configured for production!`);
            if (config.isProduction) {
                process.exit(1);
            }
        }
    });
}

module.exports = {
    ...config,
    get,
    getBool,
    getInt,
    getFloat,
    getArray,
    validateRequired,
};
