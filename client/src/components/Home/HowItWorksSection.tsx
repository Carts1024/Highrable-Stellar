import React from 'react';
import { motion } from 'framer-motion';
import { 
  MagnifyingGlassIcon, 
  UserGroupIcon, 
  CogIcon, 
  CheckCircleIcon,
  CurrencyDollarIcon,
  StarIcon
} from '@heroicons/react/24/outline';

export const HowItWorksSection: React.FC = () => {
  const freelancerSteps = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Discover Opportunity',
      description: 'Find matching job posts that suit your skills and expertise',
    },
    {
      icon: UserGroupIcon,
      title: 'Secure Agreement',
      description: 'Connect wallet, submit proposal, and sign smart contract',
    },
    {
      icon: CogIcon,
      title: 'Start Work',
      description: 'Begin knowing funds are held securely in escrow',
    },
    {
      icon: CheckCircleIcon,
      title: 'Submit Work',
      description: 'Deliver completed work and update milestone status',
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Instant Payout',
      description: 'Client approval triggers automatic stablecoin payment',
    },
    {
      icon: StarIcon,
      title: 'Build Reputation',
      description: 'Project and reviews recorded permanently on-chain',
    },
  ];

  const clientSteps = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Post Job',
      description: 'Connect wallet and create job post with clear milestones',
    },
    {
      icon: UserGroupIcon,
      title: 'Secure Agreement',
      description: 'Review proposals and confirm smart contract terms',
    },
    {
      icon: CogIcon,
      title: 'Monitor Progress',
      description: 'Track milestones and communicate with freelancer',
    },
    {
      icon: CheckCircleIcon,
      title: 'Review Work',
      description: 'Check submitted deliverables against requirements',
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Controlled Payout',
      description: 'Smart contract releases payment upon your approval',
    },
    {
      icon: StarIcon,
      title: 'Build Trust',
      description: 'On-chain project history strengthens your reputation',
    },
  ];

  return (
    <section className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            How Highrable Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our blockchain-powered platform creates a seamless experience for both freelancers and clients
          </p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Freelancer Journey */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#FF7003] to-[#FF8801] rounded-full mb-4">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">For Freelancers</h3>
              <p className="text-gray-600">Your golden path to fair and instant payments</p>
            </div>

            <div className="space-y-6">
              {freelancerSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="flex items-start space-x-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full border-2 border-[#FF7003] flex items-center justify-center shadow-sm">
                    <span className="text-[#FF7003] font-bold text-sm">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <step.icon className="w-5 h-5 text-[#FF7003] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">{step.title}</h4>
                    </div>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Client Journey */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#FF7003] to-[#FF8801] rounded-full mb-4">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">For Clients</h3>
              <p className="text-gray-600">Your secure path to finding trusted talent</p>
            </div>

            <div className="space-y-6">
              {clientSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="flex items-start space-x-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full border-2 border-[#FF7003] flex items-center justify-center shadow-sm">
                    <span className="text-[#FF7003] font-bold text-sm">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <step.icon className="w-5 h-5 text-[#FF7003] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">{step.title}</h4>
                    </div>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-16"
        >
          <div className="inline-block bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to experience trustless freelancing?
            </h3>
            <p className="text-gray-600 mb-6">
              Join thousands of freelancers and clients building the future of work
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-[#FF7003] to-[#FF8801] text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Start Your Journey
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};