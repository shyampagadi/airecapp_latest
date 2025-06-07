// AWS Configuration
export const AWS_CONFIG = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  profile: process.env.REACT_APP_AWS_PROFILE || 'default',
};

// S3 Configuration
export const S3_CONFIG = {
  bucketName: process.env.REACT_APP_SOURCE_BUCKET,
  rawPrefix: process.env.REACT_APP_SOURCE_PREFIX || 'raw/',
  processedPrefix: process.env.REACT_APP_DESTINATION_PREFIX || 'processed/',
  errorPrefix: process.env.REACT_APP_ERROR_PREFIX || 'errors/',
};

// Local Storage Configuration
export const LOCAL_STORAGE = {
  outputDir: process.env.REACT_APP_LOCAL_OUTPUT_DIR || 'output',
  errorDir: process.env.REACT_APP_LOCAL_ERROR_DIR || 'errors',
  tempDir: process.env.REACT_APP_LOCAL_TEMP_DIR || 'temp',
};

// AWS Bedrock Configuration
export const BEDROCK_CONFIG = {
  modelId: process.env.REACT_APP_MODEL_ID,
  embeddingsModel: process.env.REACT_APP_BEDROCK_EMBEDDINGS_MODEL || 'amazon.titan-embed-text-v2:0',
  maxInputTokens: parseInt(process.env.REACT_APP_BEDROCK_MAX_INPUT_TOKENS || '8000'),
  charPerToken: parseFloat(process.env.REACT_APP_BEDROCK_CHAR_PER_TOKEN || '4.0'),
};

// PostgreSQL Configuration
export const POSTGRES_CONFIG = {
  enabled: process.env.REACT_APP_ENABLE_POSTGRES !== 'false',
  host: process.env.REACT_APP_DB_HOST || 'resume-parser-cluster-instance-1.cjs4u208eeey.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.REACT_APP_DB_PORT || '5432'),
  database: process.env.REACT_APP_DB_NAME || 'resume_parser',
  user: process.env.REACT_APP_DB_USER || 'postgres',
  password: process.env.REACT_APP_DB_PASSWORD || 'postgres',
  connectionString: () => {
    return `postgresql://${POSTGRES_CONFIG.user}:${POSTGRES_CONFIG.password}@${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}/${POSTGRES_CONFIG.database}`;
  }
};

// DynamoDB Configuration
export const DYNAMODB_CONFIG = {
  enabled: process.env.REACT_APP_ENABLE_DYNAMODB !== 'false',
  tableName: process.env.REACT_APP_DYNAMODB_TABLE_NAME || 'resumedata',
  region: process.env.REACT_APP_DYNAMODB_REGION || AWS_CONFIG.region,
  endpoint: process.env.REACT_APP_DYNAMODB_ENDPOINT,
  readCapacityUnits: parseInt(process.env.REACT_APP_DYNAMODB_READ_CAPACITY_UNITS || '10'),
  writeCapacityUnits: parseInt(process.env.REACT_APP_DYNAMODB_WRITE_CAPACITY_UNITS || '5'),
};

// OpenSearch Configuration
export const OPENSEARCH_CONFIG = {
  enabled: process.env.REACT_APP_ENABLE_OPENSEARCH === 'true',
  serverless: process.env.REACT_APP_OPENSEARCH_SERVERLESS === 'true',
  endpoint: process.env.REACT_APP_OPENSEARCH_ENDPOINT,
  collectionName: process.env.REACT_APP_OPENSEARCH_COLLECTION_NAME || 'tgresumeparser',
  index: process.env.REACT_APP_OPENSEARCH_INDEX || 'resume-embeddings',
  region: process.env.REACT_APP_OPENSEARCH_REGION || AWS_CONFIG.region,
  username: process.env.REACT_APP_OPENSEARCH_USERNAME,
  password: process.env.REACT_APP_OPENSEARCH_PASSWORD,
};

// API Gateway URLs
export const API_GATEWAY = {
  opensearchGatewayUrl: process.env.REACT_APP_OPENSEARCH_GATEWAY_API_URL,
  opensearchRestApiKey: process.env.REACT_APP_OPENSEARCH_REST_API_KEY,
  jdSearchEndpoint: 'https://p1w63vjfu7.execute-api.us-east-1.amazonaws.com/dev/resumes',
  postgresEndpoint: 'https://p1w63vjfu7.execute-api.us-east-1.amazonaws.com/dev/postgres-data',
};

// Resume File Extensions
export const RESUME_FILE_EXTENSIONS = (process.env.REACT_APP_RESUME_FILE_EXTENSIONS || 'pdf,docx,doc,txt').split(',');

// Processing Configuration
export const PROCESSING_CONFIG = {
  maxWorkers: parseInt(process.env.REACT_APP_MAX_WORKERS || '8'),
  batchSize: parseInt(process.env.REACT_APP_BATCH_SIZE || '25'),
};

// Default export for the entire configuration
const CONFIG = {
  aws: AWS_CONFIG,
  s3: S3_CONFIG,
  localStorage: LOCAL_STORAGE,
  bedrock: BEDROCK_CONFIG,
  postgres: POSTGRES_CONFIG,
  dynamodb: DYNAMODB_CONFIG,
  opensearch: OPENSEARCH_CONFIG,
  apiGateway: API_GATEWAY,
  resumeFileExtensions: RESUME_FILE_EXTENSIONS,
  processing: PROCESSING_CONFIG,
};

export default CONFIG; 