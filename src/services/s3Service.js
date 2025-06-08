import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_CONFIG } from '../config/appConfig';

class S3Service {
    constructor() {
        // Log configuration to help with debugging
        console.log("S3Service: Initializing with region:", AWS_CONFIG.region);
        
        // Check if credentials are available
        const accessKeyId = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
        
        if (!accessKeyId || !secretAccessKey) {
            console.warn("S3Service: AWS credentials not found in environment variables");
        } else {
            console.log("S3Service: AWS credentials found");
        }
        
        this.s3Client = new S3Client({
            region: AWS_CONFIG.region,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            }
        });
        
        // Store a map of bucket-specific endpoints that will be populated dynamically
        // This avoids hardcoding any specific regions
        this.bucketEndpoints = {};
        
        // This will be populated dynamically if redirects are encountered
        this.bucketRegions = {};
    }

    async generatePresignedUrl(bucket, key, expiresIn = 1800) { // 30 minutes default
        try {
            console.log(`S3Service: Generating presigned URL for ${bucket}/${key}`);
            
            // If we have a specific endpoint for this bucket, create a new client with that endpoint
            let clientToUse = this.s3Client;
            const bucketRegion = this.bucketRegions[bucket] || AWS_CONFIG.region;
            
            if (this.bucketEndpoints[bucket]) {
                console.log(`S3Service: Using custom endpoint for bucket ${bucket}: ${this.bucketEndpoints[bucket]}`);
                clientToUse = new S3Client({
                    region: bucketRegion,
                    endpoint: `https://${this.bucketEndpoints[bucket]}`,
                    credentials: this.s3Client.config.credentials
                });
            } else if (bucketRegion !== AWS_CONFIG.region) {
                // Create a client with the specific region if different from default
                console.log(`S3Service: Using specific region for bucket ${bucket}: ${bucketRegion}`);
                clientToUse = new S3Client({
                    region: bucketRegion,
                    credentials: this.s3Client.config.credentials
                });
            }
            
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });

            const signedUrl = await getSignedUrl(clientToUse, command, {
                expiresIn
            });

            console.log(`S3Service: Successfully generated URL (length: ${signedUrl.length})`);
            return {
                success: true,
                url: signedUrl
            };
        } catch (error) {
            console.error('S3Service: Error generating presigned URL:', error);
            
            // Check for PermanentRedirect error and try to extract the correct endpoint
            if (error.name === 'PermanentRedirect' && error.$metadata && error.$metadata.response) {
                const responseXml = await error.$metadata.response.text();
                console.log('S3Service: Received redirect response:', responseXml);
                
                // Try to extract the endpoint from the XML response
                const endpointMatch = responseXml.match(/<Endpoint>([^<]+)<\/Endpoint>/);
                const regionMatch = responseXml.match(/\.([^.]+)\.amazonaws\.com<\/Endpoint>/);
                
                if (endpointMatch && endpointMatch[1]) {
                    const correctEndpoint = endpointMatch[1];
                    console.log(`S3Service: Extracted correct endpoint: ${correctEndpoint}`);
                    
                    // Save this endpoint for future requests
                    this.bucketEndpoints[bucket] = correctEndpoint;
                    
                    // Also extract and save the region if possible
                    if (regionMatch && regionMatch[1]) {
                        const region = regionMatch[1];
                        console.log(`S3Service: Extracted region from endpoint: ${region}`);
                        this.bucketRegions[bucket] = region;
                    }
                    
                    // Retry with the correct endpoint
                    console.log(`S3Service: Retrying with correct endpoint for ${bucket}`);
                    return this.generatePresignedUrl(bucket, key, expiresIn);
                }
            }
            
            // Handle other specific errors
            if (error.name === 'CredentialsProviderError') {
                console.error('S3Service: AWS credentials are invalid or missing');
            } else if (error.name === 'NoSuchKey') {
                console.error('S3Service: The specified key does not exist in the bucket');
            }
            
            return {
                success: false,
                error: `Failed to generate file access URL: ${error.message}`
            };
        }
    }

    async getResumeUrl(fileInfo) {
        try {
            if (!fileInfo || !fileInfo.s3_bucket || !fileInfo.s3_key) {
                throw new Error('Invalid file information');
            }
            
            console.log(`S3Service: Getting resume URL for ${fileInfo.s3_bucket}/${fileInfo.s3_key}`);

            return await this.generatePresignedUrl(
                fileInfo.s3_bucket,
                fileInfo.s3_key
            );
        } catch (error) {
            console.error('S3Service: Error getting resume URL:', error);
            return {
                success: false,
                error: `Failed to get resume file URL: ${error.message}`
            };
        }
    }
}

// Create a singleton instance
const s3Service = new S3Service();
export default s3Service; 