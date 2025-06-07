# JD Search Application

A professional-grade React application that allows users to input Job Descriptions (JD) and find matching resumes through AWS services.

## Features

- Secure authentication with AWS Cognito
- Rich text editing for job descriptions
- Integration with AWS API Gateway and Lambda
- Responsive UI built with Bootstrap 5
- Protected routes for authenticated users

## Setup

### Prerequisites

- Node.js and npm installed
- AWS Cognito User Pool set up
- AWS API Gateway configured with Lambda backend
- OpenSearch index for resume matching

### Installation

1. Clone the repository
2. Install dependencies:

```bash
git init
npm install aws-amplify bootstrap@5.3.2 react-bootstrap react-router-dom react-quill axios
```

3. Create a `.env` file in the root directory with the following environment variables:

```
# API Gateway Configuration
REACT_APP_API_ENDPOINT=https://your-api-gateway-endpoint.amazonaws.com
```

4. Start the development server:

```bash
npm start
```

## Environment Variables

The application requires only the following environment variable:

- `REACT_APP_API_ENDPOINT`: Your AWS API Gateway endpoint URL

The Cognito configuration is already set up in the `src/config.js` file.

## Usage

1. Navigate to the application in your browser
2. Log in using your Cognito credentials
3. Enter a job description in the rich text editor
4. Submit the job description to find matching resumes
5. View the results displayed below the form

## Technologies Used

- React 19.1.0
- AWS Amplify
- AWS Cognito
- AWS API Gateway
- AWS Lambda
- Bootstrap 5
- React Router
- React Quill

## License

[MIT](LICENSE)
