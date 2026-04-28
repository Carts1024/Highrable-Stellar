import React from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useJobs } from '../hooks/useJobs';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Calendar, DollarSign } from 'lucide-react';

export const PostJob: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { createJob } = useJobs();
  const navigate = useNavigate();

  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    budget: '',
    deadline: '',
    skills: ['']
  });

  const [milestones, setMilestones] = React.useState([
    { title: '', description: '', amount: '', dueDate: '' }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address) {
      alert('Please connect your wallet to post a job');
      return;
    }

    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0);
    if (totalMilestoneAmount !== parseFloat(formData.budget)) {
      alert('Milestone amounts must equal the total budget');
      return;
    }

    const jobData = {
      title: formData.title,
      description: formData.description,
      budget: parseFloat(formData.budget),
      deadline: formData.deadline,
      skills: formData.skills.filter(skill => skill.trim() !== ''),
      client: `Client ${address.slice(0, 6)}...${address.slice(-4)}`,
      clientAddress: address,
      milestones: milestones.map((m, index) => ({
        id: `${Date.now()}-${index}`,
        title: m.title,
        description: m.description,
        amount: parseFloat(m.amount),
        dueDate: m.dueDate,
        status: 'pending' as const
      }))
    };

    try {
      await createJob(jobData);
      alert('Job posted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error posting job:', error);
      alert('Error posting job. Please try again.');
    }
  };

  const addSkill = () => {
    setFormData(prev => ({ ...prev, skills: [...prev.skills, ''] }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const updateSkill = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => i === index ? value : skill)
    }));
  };

  const addMilestone = () => {
    setMilestones(prev => [...prev, { title: '', description: '', amount: '', dueDate: '' }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: string, value: string) => {
    setMilestones(prev => prev.map((milestone, i) => 
      i === index ? { ...milestone, [field]: value } : milestone
    ));
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
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to post jobs and hire talented freelancers on the Web3 platform
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Post a <span className="bg-gradient-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">Web3 Job</span>
        </h1>
        <p className="text-lg text-gray-600">
          Create a job with smart contract escrow protection for guaranteed payment
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden"
      >
        <div className="p-8 space-y-8">
          {/* Basic Information */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-3">
              Job Details
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                placeholder="e.g., React Developer for DeFi Dashboard"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Description *
              </label>
              <textarea
                required
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                placeholder="Describe your project requirements, expectations, and deliverables..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  Total Budget (USD) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.budget}
                  onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                  placeholder="2500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Project Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-3">
              Required Skills
            </h2>
            
            <div className="space-y-3">
              {formData.skills.map((skill, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => updateSkill(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                    placeholder="e.g., React, TypeScript, Web3"
                  />
                  {formData.skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSkill}
                className="flex items-center space-x-2 text-[#FF7003] hover:bg-[#FF7003]/5 px-3 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Skill</span>
              </button>
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-3">
              Project Milestones
            </h2>
            
            <div className="space-y-6">
              {milestones.map((milestone, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Milestone {index + 1}</h3>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Milestone Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={milestone.title}
                        onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                        placeholder="e.g., UI/UX Design & Setup"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (USD) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={milestone.amount}
                        onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                        placeholder="750"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                      placeholder="Describe what needs to be delivered for this milestone..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={milestone.dueDate}
                      onChange={(e) => updateMilestone(index, 'dueDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF7003] focus:border-[#FF7003] transition-all duration-200"
                    />
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addMilestone}
                className="flex items-center space-x-2 text-[#FF7003] hover:bg-[#FF7003]/5 px-3 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Milestone</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total Budget: ${formData.budget ? parseFloat(formData.budget).toLocaleString() : '0'}
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-[#FF7003] to-[#FF8801] text-white px-8 py-3 rounded-lg font-semibold hover:from-[#E85D00] hover:to-[#E87A00] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Post Job with Smart Contract
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};