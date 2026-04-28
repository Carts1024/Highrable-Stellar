import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, CheckCircle } from 'lucide-react';
import { Job } from '../../types';

interface JobCardProps {
  job: Job;
  onApply?: (jobId: string) => void;
  showApplications?: boolean;
  onViewApplications?: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  onApply, 
  showApplications = false,
  onViewApplications 
}) => {
  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'disputed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const completedMilestones = job.milestones.filter(m => m.status === 'approved').length;
  const totalMilestones = job.milestones.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-2xl border border-gray-100 hover:border-[#FF7003]/20 hover:shadow-2xl transition-all duration-300 overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-6 border-b border-gray-50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
              {job.title}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span>{job.client}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(job.deadline).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#FF7003]">
                ${job.budget.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Budget</div>
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
          {job.description}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
              +{job.skills.length - 4} more
            </span>
          )}
        </div>

        {/* Milestones Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span className="flex items-center space-x-1">
              <CheckCircle className="w-4 h-4" />
              <span>Milestones</span>
            </span>
            <span>{completedMilestones} of {totalMilestones} completed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-linear-to-r from-[#FF7003] to-[#FF8801] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedMilestones / totalMilestones) * 100}%` }}
            />
          </div>
        </div>

        {/* Applications Count */}
        {showApplications && (
          <div className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
            <User className="w-4 h-4" />
            <span>{job.applications?.length || 0} applications</span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </div>
          <div className="flex space-x-3">
            {showApplications && onViewApplications && (
              <button
                onClick={() => onViewApplications(job.id)}
                className="px-4 py-2 text-[#FF7003] border border-[#FF7003] rounded-lg font-medium hover:bg-[#FF7003] hover:text-white transition-all duration-200 text-sm"
              >
                View Applications
              </button>
            )}
            {onApply && job.status === 'open' && (
              <button
                onClick={() => onApply(job.id)}
                className="px-4 py-2 bg-linear-to-r from-[#FF7003] to-[#FF8801] text-white rounded-lg font-medium hover:from-[#E85D00] hover:to-[#E87A00] transition-all duration-200 text-sm shadow-md hover:shadow-lg"
              >
                Apply Now
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};