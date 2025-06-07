import { Pool } from 'pg';
import { POSTGRES_CONFIG } from '../config/appConfig';

class PostgresService {
    constructor() {
        this.pool = new Pool({
            host: POSTGRES_CONFIG.host,
            port: POSTGRES_CONFIG.port,
            database: POSTGRES_CONFIG.database,
            user: POSTGRES_CONFIG.user,
            password: POSTGRES_CONFIG.password,
            ssl: {
                rejectUnauthorized: false // For development, use proper SSL in production
            },
            min: 5, // Minimum pool size
            max: 20, // Maximum pool size
            idleTimeoutMillis: 10000, // How long a client is allowed to remain idle before being closed
        });

        // Error handling for the pool
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }

    async getPIIDataByResumeId(resumeId) {
        try {
            const query = `
                SELECT 
                    resume_id,
                    name,
                    email,
                    phone_number,
                    address,
                    linkedin_url,
                    s3_bucket,
                    s3_key,
                    original_filename,
                    file_type
                FROM resume_pii 
                WHERE resume_id = $1
            `;
            
            const result = await this.pool.query(query, [resumeId]);
            return {
                success: true,
                data: result.rows[0] || null
            };
        } catch (error) {
            console.error('Error fetching PII data:', error);
            return {
                success: false,
                error: 'Failed to fetch candidate data'
            };
        }
    }

    async getPIIDataBatchByResumeIds(resumeIds) {
        try {
            const query = `
                SELECT 
                    resume_id,
                    name,
                    email,
                    phone_number,
                    address,
                    linkedin_url,
                    s3_bucket,
                    s3_key,
                    original_filename,
                    file_type
                FROM resume_pii 
                WHERE resume_id = ANY($1)
            `;
            
            const result = await this.pool.query(query, [resumeIds]);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Error fetching batch PII data:', error);
            return {
                success: false,
                error: 'Failed to fetch candidate data batch'
            };
        }
    }

    async getResumeFileInfo(resumeId) {
        try {
            const query = `
                SELECT 
                    s3_bucket,
                    s3_key,
                    original_filename,
                    file_type
                FROM resume_pii 
                WHERE resume_id = $1
            `;
            
            const result = await this.pool.query(query, [resumeId]);
            return {
                success: true,
                data: result.rows[0] || null
            };
        } catch (error) {
            console.error('Error fetching resume file info:', error);
            return {
                success: false,
                error: 'Failed to fetch resume file information'
            };
        }
    }

    // Cleanup method to be called when shutting down the application
    async close() {
        await this.pool.end();
    }
}

// Create a singleton instance
const postgresService = new PostgresService();
export default postgresService; 