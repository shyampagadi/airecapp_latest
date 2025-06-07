import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_CONFIG } from '../config/appConfig';

class S3Service {
    constructor() {
        this.s3Client = new S3Client({
            region: AWS_CONFIG.region,
            credentials: {
                accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
            }
        });
    }

    async generatePresignedUrl(bucket, key, expiresIn = 1800) { // 30 minutes default
        try {
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });

            const signedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn
            });

            return {
                success: true,
                url: signedUrl
            };
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            return {
                success: false,
                error: 'Failed to generate file access URL'
            };
        }
    }

    async getResumeUrl(fileInfo) {
        try {
            if (!fileInfo || !fileInfo.s3_bucket || !fileInfo.s3_key) {
                throw new Error('Invalid file information');
            }

            return await this.generatePresignedUrl(
                fileInfo.s3_bucket,
                fileInfo.s3_key
            );
        } catch (error) {
            console.error('Error getting resume URL:', error);
            return {
                success: false,
                error: 'Failed to get resume file URL'
            };
        }
    }
}

// Create a singleton instance
const s3Service = new S3Service();
export default s3Service; 