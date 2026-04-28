"use client";

import { APP_NAME } from "@/core/constants";
import { BriefcaseIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Link from "next/link";

/** Renders the marketing footer for the Highrable landing page. */
export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid gap-8 md:grid-cols-4"
        >
          <div className="col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="mb-4 flex items-center space-x-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#FF7003] to-[#FF8801]">
                <BriefcaseIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">{APP_NAME}</span>
            </motion.div>
            <p className="text-sm leading-relaxed text-gray-400">
              The future of freelancing built on blockchain technology. Fair pay guaranteed, trust
              built in.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h3 className="mb-4 text-lg font-semibold">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/jobs"
                  className="text-gray-400 transition-colors duration-200 hover:text-[#FF7003]"
                >
                  Find Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/post-job"
                  className="text-gray-400 transition-colors duration-200 hover:text-[#FF7003]"
                >
                  Post a Job
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-gray-400 transition-colors duration-200 hover:text-[#FF7003]"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-gray-400 transition-colors duration-200 hover:text-[#FF7003]"
                >
                  How it Works
                </Link>
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <h3 className="mb-4 text-lg font-semibold">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-gray-400">Documentation</span>
              </li>
              <li>
                <span className="text-gray-400">Whitepaper</span>
              </li>
              <li>
                <span className="text-gray-400">Security</span>
              </li>
              <li>
                <span className="text-gray-400">FAQ</span>
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h3 className="mb-4 text-lg font-semibold">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-gray-400">About Us</span>
              </li>
              <li>
                <span className="text-gray-400">Blog</span>
              </li>
              <li>
                <span className="text-gray-400">Privacy Policy</span>
              </li>
              <li>
                <span className="text-gray-400">Terms of Service</span>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 flex flex-col items-center justify-between border-t border-gray-800 pt-8 sm:flex-row"
        >
          <p className="text-sm text-gray-400">© 2026 {APP_NAME}. All rights reserved.</p>
          <div className="mt-4 flex items-center space-x-6 sm:mt-0">
            <span className="text-sm text-gray-400">Built on</span>
            <div className="flex items-center space-x-2">
              <img
                src="/logo/stellar/Stellar_Symbol.png"
                alt="Stellar Network"
                className="h-6 w-6"
              />
              <span className="text-sm text-gray-400">Stellar Network</span>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
