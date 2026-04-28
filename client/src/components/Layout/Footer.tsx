import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BriefcaseIcon } from '@heroicons/react/24/outline';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid md:grid-cols-4 gap-8"
        >
          {/* Brand */}
          <div className="col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="flex items-center space-x-2 mb-4"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#FF7003] to-[#FF8801] rounded-lg flex items-center justify-center">
                <BriefcaseIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Highrable</span>
            </motion.div>
            <p className="text-gray-400 text-sm leading-relaxed">
              The future of freelancing built on blockchain technology. 
              Fair pay guaranteed, trust built-in.
            </p>
          </div>

          {/* Platform */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/jobs" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Find Jobs
                </Link>
              </li>
              <li>
                <Link to="/post-job" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Post a Job
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Dashboard
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  How it Works
                </a>
              </li>
            </ul>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Whitepaper
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Security
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  FAQ
                </a>
              </li>
            </ul>
          </motion.div>

          {/* Company */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FF7003] transition-colors duration-200">
                  Terms of Service
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center"
        >
          <p className="text-gray-400 text-sm">
            © 2025 Highrable. All rights reserved.
          </p>
          <div className="flex items-center space-x-6 mt-4 sm:mt-0">
            <span className="text-sm text-gray-400">Built on</span>
            <div className="flex items-center space-x-2">
              <img 
                src="/logo/stellar/Stellar_Symbol.png" 
                alt="Stellar Network" 
                className="w-6 h-6"
              />
              <span className="text-sm text-gray-400">Stellar Network</span>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};