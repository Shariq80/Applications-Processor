# Application Processing

A full-stack application for managing job applications with automated email processing and AI-powered resume scoring.

## Features

### Job Management
- Create and manage job postings
- Track job status (Open/Closed/On Hold)
- Detailed job descriptions and requirements

### Application Processing
- Automated email processing from Microsoft and Gmail accounts
- Batch processing support (20 applications per batch)
- Resume parsing and text extraction
- AI-powered resume scoring and evaluation
- Real-time processing status updates

### Application Review
- Interactive application review interface
- Shortlisting capabilities
- Bulk actions (delete, send)
- Advanced filtering:
  - Date-based filtering
  - AI score filtering
- Real-time updates every 5 seconds

### Email Integration
- Microsoft Office 365 support
- Gmail support
- Attachment handling (PDF, DOC, DOCX)
- Automated email responses

## Technical Stack

### Frontend
- React.js
- Tailwind CSS
- Context API for state management
- React Hot Toast for notifications

### Backend
- Node.js
- Express.js
- MongoDB
- OpenAI integration for resume scoring

## Security Features
- Request timeout handling (5s)
- Error handling and validation
- Secure API endpoints
- Account-based access control

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/Shariq80/Applications-Processor
```

2. Install dependencies
```bash
cd Application-Processing
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Update .env with your configurations
```

4. Start the application
```bash
npm run dev
```