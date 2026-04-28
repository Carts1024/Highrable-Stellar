/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Shield, Zap, Globe, DollarSign } from 'lucide-react';

export const Hero: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const features = [
    {
      icon: Shield,
      title: 'Trustless Escrow',
      description: 'Funds protected by blockchain technology until work is completed'
    },
    {
      icon: Zap,
      title: 'Instant Payouts',
      description: 'Get paid immediately upon milestone approval'
    },
    {
      icon: Globe,
      title: 'Borderless Work',
      description: 'Access global opportunities without currency barriers'
    },
    {
      icon: DollarSign,
      title: 'Lower Fees',
      description: 'Keep more of what you earn with transparent pricing'
    }
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF7003]/5 to-[#FF8801]/10 -z-10" />
      
      {/* Main Hero Section */}
      <div className="relative pt-16 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Freelancing with
            <span className="block bg-gradient-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">
              Guaranteed Trust
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            The Web3 freelancing platform where smart contracts eliminate payment risks, 
            reduce fees, and create a trustless ecosystem for global collaboration.
          </p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <button
              onClick={() => navigate('/jobs')}
              className="bg-gradient-to-r from-[#FF7003] to-[#FF8801] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-[#E85D00] hover:to-[#E87A00] transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
            >
              Find Work
            </button>
            <button
              onClick={() => navigate('/post-job')}
              className="bg-white border-2 border-[#FF7003] text-[#FF7003] px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#FF7003] hover:text-white transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
            >
              Hire Talent
            </button>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 group hover:border-[#FF7003]/20"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF7003] to-[#FF8801] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 text-center"
        >
          <p className="text-gray-500 text-sm mb-6">Trusted by the blockchain community</p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-12 text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Secure Smart Contracts</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-[#FF7003] rounded-full animate-pulse"></div>
              <span className="font-medium">Stellar Network</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Decentralized Platform</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};