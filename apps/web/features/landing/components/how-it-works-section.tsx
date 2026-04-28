"use client";

import {
  CheckCircleIcon,
  CogIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Link from "next/link";

/** Explains the workflow for freelancers and clients on Highrable. */
export function HowItWorksSection() {
  const freelancerSteps = [
    {
      icon: MagnifyingGlassIcon,
      title: "Discover Opportunity",
      description: "Find matching job posts that suit your skills and expertise",
    },
    {
      icon: UserGroupIcon,
      title: "Secure Agreement",
      description: "Connect wallet, submit proposal, and sign smart contract",
    },
    {
      icon: CogIcon,
      title: "Start Work",
      description: "Begin knowing funds are held securely in escrow",
    },
    {
      icon: CheckCircleIcon,
      title: "Submit Work",
      description: "Deliver completed work and update milestone status",
    },
    {
      icon: CurrencyDollarIcon,
      title: "Instant Payout",
      description: "Client approval triggers automatic stablecoin payment",
    },
    {
      icon: StarIcon,
      title: "Build Reputation",
      description: "Project and reviews recorded permanently on-chain",
    },
  ];

  const clientSteps = [
    {
      icon: MagnifyingGlassIcon,
      title: "Post Job",
      description: "Connect wallet and create job post with clear milestones",
    },
    {
      icon: UserGroupIcon,
      title: "Secure Agreement",
      description: "Review proposals and confirm smart contract terms",
    },
    {
      icon: CogIcon,
      title: "Monitor Progress",
      description: "Track milestones and communicate with freelancer",
    },
    {
      icon: CheckCircleIcon,
      title: "Review Work",
      description: "Check submitted deliverables against requirements",
    },
    {
      icon: CurrencyDollarIcon,
      title: "Controlled Payout",
      description: "Smart contract releases payment upon your approval",
    },
    {
      icon: StarIcon,
      title: "Build Trust",
      description: "On-chain project history strengthens your reputation",
    },
  ];

  return (
    <section className="bg-gray-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-gray-900 lg:text-4xl">How Highrable Works</h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-600">
            Our blockchain-powered platform creates a seamless experience for both freelancers and
            clients
          </p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Freelancer Journey */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#FF7003] to-[#FF8801]">
                <span className="text-lg font-bold text-white">F</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-900">For Freelancers</h3>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#FF7003] bg-white shadow-sm">
                    <span className="text-sm font-bold text-[#FF7003]">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center">
                      <step.icon className="mr-2 h-5 w-5 text-[#FF7003]" />
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
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#FF7003] to-[#FF8801]">
                <span className="text-lg font-bold text-white">C</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-900">For Clients</h3>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#FF7003] bg-white shadow-sm">
                    <span className="text-sm font-bold text-[#FF7003]">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center">
                      <step.icon className="mr-2 h-5 w-5 text-[#FF7003]" />
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
          className="mt-16 text-center"
        >
          <div className="inline-block rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
            <h3 className="mb-4 text-2xl font-bold text-gray-900">
              Ready to experience trustless freelancing?
            </h3>
            <p className="mb-6 text-gray-600">
              Join thousands of freelancers and clients building the future of work
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-[#FF7003] to-[#FF8801] px-8 py-3 font-semibold text-white transition-all duration-200 hover:shadow-lg"
              >
                Start Your Journey
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
