/**
 * Swagger/OpenAPI Documentation Configuration
 * 
 * Generates comprehensive API documentation for the HR System.
 * 
 * @module config/swagger
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const env = require('./environment');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Enterprise HR System API',
            version: '1.0.0',
            description: `
## Enterprise HR Management System API

A comprehensive HR management platform with:
- **Leave Management** - Request, approve, and track employee leave
- **Onboarding** - Automated employee onboarding workflows
- **Payroll** - Salary and payroll management
- **Performance** - Employee performance tracking
- **Recruitment** - Job postings and candidate management

### Authentication

All endpoints require JWT authentication unless marked as public.
Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

### Rate Limiting

API requests are rate limited to prevent abuse:
- **100 requests** per **15 minutes** per IP
- Login endpoints: **5 attempts** before lockout

### Error Responses

All errors follow a standard format:
\`\`\`json
{
  "success": false,
  "error": "Error type",
  "code": "ERROR_CODE",
  "message": "Human readable message"
}
\`\`\`
            `,
            contact: {
                name: 'API Support',
                email: 'api-support@company.com',
            },
            license: {
                name: 'Proprietary',
                url: 'https://company.com/license',
            },
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server',
            },
            {
                url: 'https://api.company.com',
                description: 'Production server',
            },
        ],
        tags: [
            { name: 'Authentication', description: 'User authentication and session management' },
            { name: 'Users', description: 'User management operations' },
            { name: 'Employees', description: 'Employee data management' },
            { name: 'Leave', description: 'Leave request and management' },
            { name: 'Onboarding', description: 'Employee onboarding workflows' },
            { name: 'Payroll', description: 'Payroll and compensation' },
            { name: 'Performance', description: 'Performance reviews and tracking' },
            { name: 'Recruitment', description: 'Job postings and candidates' },
            { name: 'System', description: 'System health and configuration' },
            { name: 'Webhooks', description: 'Webhook management for integrations' },
            { name: 'Compliance', description: 'GDPR and compliance operations' },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Error type' },
                        code: { type: 'string', example: 'ERROR_CODE' },
                        message: { type: 'string', example: 'Human readable message' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', format: 'email', example: 'john@company.com' },
                        role: { type: 'string', enum: ['admin', 'hr', 'manager', 'employee'], example: 'employee' },
                        empId: { type: 'string', example: 'EMP001' },
                        department: { type: 'string', example: 'Engineering' },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'user@company.com' },
                        password: { type: 'string', format: 'password', example: 'SecurePass123!' },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        user: { $ref: '#/components/schemas/User' },
                        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                        expiresAt: { type: 'string', format: 'date-time' },
                        tokenType: { type: 'string', example: 'Bearer' },
                    },
                },
                LeaveRequest: {
                    type: 'object',
                    required: ['leaveType', 'startDate', 'endDate', 'reason'],
                    properties: {
                        leaveType: { 
                            type: 'string', 
                            enum: ['vacation', 'sick', 'personal', 'emergency', 'maternity', 'paternity'],
                            example: 'vacation' 
                        },
                        startDate: { type: 'string', format: 'date', example: '2026-02-01' },
                        endDate: { type: 'string', format: 'date', example: '2026-02-05' },
                        reason: { type: 'string', example: 'Family vacation' },
                        halfDay: { type: 'boolean', example: false },
                    },
                },
                LeaveResponse: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        employeeId: { type: 'string', example: 'EMP001' },
                        leaveType: { type: 'string', example: 'vacation' },
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                        days: { type: 'number', example: 5 },
                        status: { 
                            type: 'string', 
                            enum: ['pending', 'approved', 'rejected', 'cancelled'],
                            example: 'pending' 
                        },
                        reason: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                LeaveBalance: {
                    type: 'object',
                    properties: {
                        vacation: { type: 'number', example: 15 },
                        sick: { type: 'number', example: 10 },
                        personal: { type: 'number', example: 5 },
                        emergency: { type: 'number', example: 3 },
                        total: { type: 'number', example: 33 },
                    },
                },
                Employee: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        empId: { type: 'string', example: 'EMP001' },
                        name: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', format: 'email' },
                        department: { type: 'string', example: 'Engineering' },
                        jobTitle: { type: 'string', example: 'Software Engineer' },
                        managerId: { type: 'integer', example: 2 },
                        hireDate: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['active', 'inactive', 'terminated'] },
                    },
                },
                HealthCheck: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        version: { type: 'string', example: '1.0.0' },
                        checks: {
                            type: 'object',
                            properties: {
                                database: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        responseTime: { type: 'number' },
                                    },
                                },
                            },
                        },
                    },
                },
                Webhook: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string', example: 'Leave Notification' },
                        url: { type: 'string', format: 'uri', example: 'https://example.com/webhook' },
                        events: { 
                            type: 'array', 
                            items: { type: 'string' },
                            example: ['leave.approved', 'leave.rejected']
                        },
                        isActive: { type: 'boolean' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        total: { type: 'integer', example: 100 },
                        totalPages: { type: 'integer', example: 5 },
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Authentication required or token invalid',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                error: 'Authentication required',
                                code: 'NO_TOKEN',
                                message: 'No authentication token provided',
                            },
                        },
                    },
                },
                Forbidden: {
                    description: 'Insufficient permissions',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                error: 'Access denied',
                                code: 'INSUFFICIENT_PERMISSIONS',
                                message: 'You do not have permission to access this resource',
                            },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                error: 'Not found',
                                code: 'RESOURCE_NOT_FOUND',
                                message: 'The requested resource was not found',
                            },
                        },
                    },
                },
                ValidationError: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                error: 'Validation error',
                                code: 'VALIDATION_FAILED',
                                message: 'Please check your input',
                                errors: [{ field: 'email', message: 'Invalid email format' }],
                            },
                        },
                    },
                },
                RateLimited: {
                    description: 'Too many requests',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                success: false,
                                error: 'Too many requests',
                                code: 'RATE_LIMITED',
                                message: 'Please slow down your requests',
                                retryAfter: 900,
                            },
                        },
                    },
                },
            },
        },
        security: [{ BearerAuth: [] }],
        paths: {
            // Authentication Endpoints
            '/api/auth/login': {
                post: {
                    tags: ['Authentication'],
                    summary: 'User login',
                    description: 'Authenticate user and receive JWT tokens',
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginRequest' },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: 'Login successful',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/LoginResponse' },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                        429: { $ref: '#/components/responses/RateLimited' },
                    },
                },
            },
            '/api/auth/refresh': {
                post: {
                    tags: ['Authentication'],
                    summary: 'Refresh access token',
                    description: 'Get a new access token using refresh token',
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['refreshToken'],
                                    properties: {
                                        refreshToken: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: 'Token refreshed successfully',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/LoginResponse' },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
            '/api/auth/logout': {
                post: {
                    tags: ['Authentication'],
                    summary: 'Logout',
                    description: 'Invalidate current refresh token',
                    responses: {
                        200: {
                            description: 'Logged out successfully',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean', example: true },
                                            message: { type: 'string', example: 'Logged out successfully' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    tags: ['Authentication'],
                    summary: 'Get current user',
                    description: 'Get the currently authenticated user profile',
                    responses: {
                        200: {
                            description: 'User profile',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            user: { $ref: '#/components/schemas/User' },
                                        },
                                    },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
            // Leave Endpoints
            '/api/leaves': {
                get: {
                    tags: ['Leave'],
                    summary: 'Get leave requests',
                    description: 'Get leave requests for current user or all (HR/Admin)',
                    parameters: [
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
                        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
                        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: {
                        200: {
                            description: 'List of leave requests',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/LeaveResponse' },
                                            },
                                            pagination: { $ref: '#/components/schemas/Pagination' },
                                        },
                                    },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
                post: {
                    tags: ['Leave'],
                    summary: 'Create leave request',
                    description: 'Submit a new leave request',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LeaveRequest' },
                            },
                        },
                    },
                    responses: {
                        201: {
                            description: 'Leave request created',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: { $ref: '#/components/schemas/LeaveResponse' },
                                        },
                                    },
                                },
                            },
                        },
                        400: { $ref: '#/components/responses/ValidationError' },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
            '/api/leaves/balance': {
                get: {
                    tags: ['Leave'],
                    summary: 'Get leave balance',
                    description: 'Get current user leave balance by type',
                    responses: {
                        200: {
                            description: 'Leave balances',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: { $ref: '#/components/schemas/LeaveBalance' },
                                        },
                                    },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
            '/api/leaves/{id}/approve': {
                post: {
                    tags: ['Leave'],
                    summary: 'Approve leave request',
                    description: 'Approve a pending leave request (Manager/HR only)',
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                    ],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        comment: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Leave request approved' },
                        401: { $ref: '#/components/responses/Unauthorized' },
                        403: { $ref: '#/components/responses/Forbidden' },
                        404: { $ref: '#/components/responses/NotFound' },
                    },
                },
            },
            // Health Endpoints
            '/api/health': {
                get: {
                    tags: ['System'],
                    summary: 'System health check',
                    description: 'Get overall system health status',
                    security: [],
                    responses: {
                        200: {
                            description: 'System is healthy',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthCheck' },
                                },
                            },
                        },
                        503: {
                            description: 'System is unhealthy',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthCheck' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/health/live': {
                get: {
                    tags: ['System'],
                    summary: 'Liveness probe',
                    description: 'Check if the service is alive (for Kubernetes)',
                    security: [],
                    responses: {
                        200: { description: 'Service is alive' },
                    },
                },
            },
            '/api/health/ready': {
                get: {
                    tags: ['System'],
                    summary: 'Readiness probe',
                    description: 'Check if the service is ready to accept traffic',
                    security: [],
                    responses: {
                        200: { description: 'Service is ready' },
                        503: { description: 'Service is not ready' },
                    },
                },
            },
            // Webhook Endpoints
            '/api/webhooks': {
                get: {
                    tags: ['Webhooks'],
                    summary: 'List webhooks',
                    description: 'Get all configured webhooks (Admin only)',
                    responses: {
                        200: {
                            description: 'List of webhooks',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/Webhook' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { $ref: '#/components/responses/Unauthorized' },
                        403: { $ref: '#/components/responses/Forbidden' },
                    },
                },
                post: {
                    tags: ['Webhooks'],
                    summary: 'Create webhook',
                    description: 'Register a new webhook endpoint',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'url', 'events'],
                                    properties: {
                                        name: { type: 'string' },
                                        url: { type: 'string', format: 'uri' },
                                        events: { type: 'array', items: { type: 'string' } },
                                        secret: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Webhook created' },
                        401: { $ref: '#/components/responses/Unauthorized' },
                        403: { $ref: '#/components/responses/Forbidden' },
                    },
                },
            },
            // GDPR Endpoints
            '/api/compliance/gdpr/export': {
                post: {
                    tags: ['Compliance'],
                    summary: 'Request data export',
                    description: 'Request a GDPR-compliant export of personal data',
                    responses: {
                        202: { description: 'Export request accepted' },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
            '/api/compliance/gdpr/delete': {
                post: {
                    tags: ['Compliance'],
                    summary: 'Request data deletion',
                    description: 'Request deletion of personal data (right to be forgotten)',
                    responses: {
                        202: { description: 'Deletion request accepted' },
                        401: { $ref: '#/components/responses/Unauthorized' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 * @param {Express.Application} app - Express application
 */
function setupSwagger(app) {
    if (!env.swagger.enabled) {
        return;
    }

    const swaggerOptions = {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'HR System API Documentation',
    };

    app.use(env.swagger.path, swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
    
    // Also serve raw OpenAPI spec
    app.get(`${env.swagger.path}/spec.json`, (req, res) => {
        res.json(specs);
    });

    console.log(`📚 API Documentation available at ${env.swagger.path}`);
}

module.exports = {
    specs,
    setupSwagger,
};
