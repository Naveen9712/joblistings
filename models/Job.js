const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // Recruiter Information
  recruiterName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  recruiterEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  recruiterPhone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  sharePhoneNumber: {
    type: Boolean,
    default: false
  },
  recruiterCompany: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Job Information
  jobHeader: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  jobDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  jobRoleName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  jobPrimaryTechnology: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  jobSecondaryTechnology: {
    type: String,
    trim: true,
    maxlength: 100
  },
  jobLocationCity: {
    type: String,
    trim: true,
    maxlength: 100
  },
  jobLocationState: {
    type: String,
    trim: true,
    maxlength: 50
  },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
    trim: true
  },
  jobPayRatePerHour: {
    type: Number,
    min: 0
  },
  jobPayRateYearly: {
    type: Number,
    min: 0
  },
  jobContractLength: {
    type: String,
    enum: ['1 month', '3 months', '6 months', '1 year', '2 years', 'Permanent'],
    trim: true
  },
  workLocation: {
    remote: {
      type: Boolean,
      default: false
    },
    hybrid: {
      type: Boolean,
      default: false
    },
    onsite: {
      type: Boolean,
      default: false
    }
  },
  visaType: {
    type: String,
    enum: ['US Citizen', 'Green Card', 'H1B', 'L1', 'OPT/CPT', 'TN', 'No Sponsorship'],
    trim: true
  },
  autoDeleteInDays: {
    type: String,
    required: true,
    enum: ['30 days', '60 days', '90 days', 'Never']
  },

  // System fields
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  expirationDate: {
    type: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Pre-save middleware to calculate expiration date
jobSchema.pre('save', function(next) {
  if (this.autoDeleteInDays !== 'Never' && this.isNew) {
    const days = parseInt(this.autoDeleteInDays.split(' ')[0]);
    this.expirationDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  }
  next();
});

// Index for better query performance
jobSchema.index({ jobType: 1, visaType: 1, status: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ expirationDate: 1 });

module.exports = mongoose.model('Job', jobSchema);