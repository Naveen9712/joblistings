const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Job = require('./models/Job'); 

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [
    'https://symantrix365.onrender.com',
    'http://localhost:3000', // for local development
    'http://localhost:5173'  // for Vite dev server
  ],
  credentials: true
}));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || '';

async function connectToDatabase() {
    if (!MONGODB_URI) {
        console.error('Missing MONGODB_URI. Please set it in .env');
        process.exit(1);
    }
    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: process.env.DB_NAME || 'symantrix365'
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
}

// Validation helper
const validateJobData = (data) => {
  const errors = [];
  
  if (!data.recruiterName?.trim()) errors.push('Recruiter name is required');
  if (!data.recruiterEmail?.trim()) errors.push('Recruiter email is required');
  if (!data.recruiterCompany?.trim()) errors.push('Recruiter company is required');
  if (!data.jobHeader?.trim()) errors.push('Job header is required');
  if (!data.jobDescription?.trim()) errors.push('Job description is required');
  if (!data.jobRoleName?.trim()) errors.push('Job role name is required');
  if (!data.jobPrimaryTechnology?.trim()) errors.push('Primary technology is required');
  if (!data.autoDeleteInDays) errors.push('Auto delete option is required');
  
  // Validate work location (at least one must be selected)
  const workLocation = data.workLocation;
  if (!workLocation?.remote && !workLocation?.hybrid && !workLocation?.onsite) {
    errors.push('At least one work location option must be selected');
  }
  
  return errors;
};

// API Routes

// GET all active jobs with pagination and filtering
app.get('/api/jobs', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const filter = { status: 'active' };
      
      if (req.query.jobType) filter.jobType = req.query.jobType;
      if (req.query.visaType) filter.visaType = req.query.visaType;
      if (req.query.jobLocationState) filter.jobLocationState = req.query.jobLocationState;
      
      if (req.query.search) {
        filter.$or = [
          { jobHeader: { $regex: req.query.search, $options: 'i' } },
          { jobRoleName: { $regex: req.query.search, $options: 'i' } },
          { recruiterCompany: { $regex: req.query.search, $options: 'i' } },
          { jobPrimaryTechnology: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      const jobs = await Job.find(filter)
        .select('-recruiterEmail -recruiterPhone') // Hide sensitive info
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(); // Add .lean() for better performance
        
      const total = await Job.countDocuments(filter);
      
      // Transform _id to id for frontend compatibility
      const transformedJobs = jobs.map(job => ({
        ...job,
        id: job._id.toString(),
        _id: job._id.toString()
      }));
      
      res.json({
        jobs: transformedJobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ message: 'Error fetching jobs', error: error.message });
    }
  });

// GET single job by ID
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Error fetching job', error: error.message });
  }
});

// POST create new job
app.post('/api/jobs', async (req, res) => {
  try {
    // Validate required fields
    const validationErrors = validateJobData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    const job = new Job(req.body);
    await job.save();
    
    res.status(201).json({ 
      message: 'Job posted successfully', 
      job: {
        id: job._id,
        jobHeader: job.jobHeader,
        jobRoleName: job.jobRoleName,
        recruiterCompany: job.recruiterCompany,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating job:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ message: 'Error creating job', error: error.message });
  }
});

// PUT update job (for recruiters to edit their posts)
app.put('/api/jobs/:id', async (req, res) => {
  try {
    const validationErrors = validateJobData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    const job = await Job.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json({ message: 'Job updated successfully', job });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Error updating job', error: error.message });
  }
});

// DELETE job (soft delete by changing status)
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id, 
      { status: 'inactive' }, 
      { new: true }
    );
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Error deleting job', error: error.message });
  }
});

// GET job statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Job.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          jobTypeStats: {
            $push: '$jobType'
          },
          avgHourlyRate: {
            $avg: { $toDouble: '$jobPayRatePerHour' }
          }
        }
      }
    ]);
    
    res.json(stats[0] || { totalJobs: 0, jobTypeStats: [], avgHourlyRate: 0 });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
      message: 'Symantrix365 Job Portal API',
      version: '1.0.0',
      endpoints: {
        jobs: '/api/jobs',
        stats: '/api/stats',
        health: '/api/health'
      }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

connectToDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});