/**
 * Migration: Add Two-Factor Authentication Support
 * 
 * Adds columns for 2FA support in users table
 */

module.exports = {
    async up(db) {
        // Check if columns exist before adding
        const columns = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const existingColumns = columns.map(c => c.COLUMN_NAME);

        if (!existingColumns.includes('two_factor_enabled')) {
            await db.execute(`
                ALTER TABLE users 
                ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0 AFTER is_active
            `);
        }

        if (!existingColumns.includes('two_factor_secret')) {
            await db.execute(`
                ALTER TABLE users 
                ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER two_factor_enabled
            `);
        }

        if (!existingColumns.includes('two_factor_recovery_codes')) {
            await db.execute(`
                ALTER TABLE users 
                ADD COLUMN two_factor_recovery_codes TEXT NULL AFTER two_factor_secret
            `);
        }

        if (!existingColumns.includes('password_changed_at')) {
            await db.execute(`
                ALTER TABLE users 
                ADD COLUMN password_changed_at TIMESTAMP NULL AFTER two_factor_recovery_codes
            `);
        }

        console.log('     Added 2FA columns to users table');
    },

    async down(db) {
        await db.execute(`
            ALTER TABLE users 
            DROP COLUMN IF EXISTS two_factor_enabled,
            DROP COLUMN IF EXISTS two_factor_secret,
            DROP COLUMN IF EXISTS two_factor_recovery_codes,
            DROP COLUMN IF EXISTS password_changed_at
        `).catch(() => {});
    }
};
