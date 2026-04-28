import React from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useJobs } from '../hooks/useJobs';
import { JobCard } from '../components/Jobs/JobCard';
import { 
  Briefcase, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Award,
  Users,
  Target
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { jobs, loading } = useJobs();

  // Filter jobs based on user role (simplified for POC)
  const userJobs = jobs.filter(job => 
    job.clientAddress === address || 
    job.applications?.some(app => app.freelancerAddress === address)
  );

  const stats = {
    totalJobs: userJobs.length,
    activeProjects: userJobs.filter(j => j.status === 'in_progress').length,
    completedProjects: userJobs.filter(j => j.status === 'completed').length,
    totalEarned: userJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + j.budget, 0)
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-12 shadow-lg"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Access Your Dashboard
          </h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to view your projects, earnings, and manage your Web3 freelancing journey
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Your <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">Dashboard</span>
        </h1>
        <p className="text-lg text-gray-600">
          Welcome back! Here's an overview of your Web3 freelancing activity
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          {
            title: 'Total Projects',
            value: stats.totalJobs.toString(),
            icon: Briefcase,
            color: 'from-[#FF7003] to-[#FF8801]',
            bgColor: 'from-[#FF7003]/10 to-[#FF8801]/10'
          },
          {
            title: 'Active Projects',
            value: stats.activeProjects.toString(),
            icon: Clock,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'from-blue-500/10 to-blue-600/10'
          },
          {
            title: 'Completed',
            value: stats.completedProjects.toString(),
            icon: CheckCircle,
            color: 'from-green-500 to-green-600',
            bgColor: 'from-green-500/10 to-green-600/10'
          },
          {
            title: 'Total Earned',
            value: `$${stats.totalEarned.toLocaleString()}`,
            icon: DollarSign,
            color: 'from-purple-500 to-purple-600',
            bgColor: 'from-purple-500/10 to-purple-600/10'
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={`bg-linear-to-br ${stat.bgColor} rounded-2xl p-6 border border-gray-100`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5 transition-all duration-200 group">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-[#FF7003] to-[#FF8801] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">Browse Jobs</p>
              <p className="text-sm text-gray-600">Find new opportunities</p>
            </div>
          </button>
          
          <button className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5 transition-all duration-200 group">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">Post a Job</p>
              <p className="text-sm text-gray-600">Hire talented freelancers</p>
            </div>
          </button>
          
          <button className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5 transition-all duration-200 group">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">View Profile</p>
              <p className="text-sm text-gray-600">Manage your reputation</p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Recent Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Your Projects</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Target className="w-4 h-4" />
            <span>{userJobs.length} total projects</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-20 h-8 bg-gray-200 rounded"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : userJobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">
              Start your Web3 freelancing journey by browsing jobs or posting a project
            </p>
            <div className="flex justify-center space-x-4">
              <button className="bg-linear-to-r from-[#FF7003] to-[#FF8801] text-white px-6 py-3 rounded-lg font-medium hover:from-[#E85D00] hover:to-[#E87A00] transition-all duration-200">
                Browse Jobs
              </button>
              <button className="bg-white border-2 border-[#FF7003] text-[#FF7003] px-6 py-3 rounded-lg font-medium hover:bg-[#FF7003] hover:text-white transition-all duration-200">
                Post a Job
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {userJobs.slice(0, 3).map((job) => (
              <JobCard 
                key={job.id} 
                job={job}
                showApplications={job.clientAddress === address}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};