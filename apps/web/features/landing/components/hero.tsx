"use client";

import { motion } from "framer-motion";
import { DollarSign, Globe, Shield, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

/** Highlights Highrable's wallet-first value proposition on the landing page. */
export function Hero() {
  const router = useRouter();

  const features = [
    {
      icon: Shield,
      title: "Trustless Escrow",
      description: "Funds protected by blockchain technology until work is completed",
    },
    {
      icon: Zap,
      title: "Instant Payouts",
      description: "Get paid immediately upon milestone approval",
    },
    {
      icon: Globe,
      title: "Borderless Work",
      description: "Access global opportunities without currency barriers",
    },
    {
      icon: DollarSign,
      title: "Lower Fees",
      description: "Keep more of what you earn with transparent pricing",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 -z-10 bg-linear-to-br from-[#FF7003]/5 to-[#FF8801]/10" />

      {/* Main Hero Section */}
      <div className="relative pt-16 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-4xl text-center"
        >
          <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl">
            Freelancing with
            <span className="block bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">
              Guaranteed Trust
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl leading-relaxed text-gray-600">
            The Web3 freelancing platform where smart contracts eliminate payment risks, reduce
            fees, and create a trustless ecosystem for global collaboration.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <button
              onClick={() => router.push("/jobs")}
              className="transform rounded-xl bg-linear-to-r from-[#FF7003] to-[#FF8801] px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:from-[#E85D00] hover:to-[#E87A00] hover:shadow-2xl"
            >
              Find Work
            </button>
            <button
              onClick={() => router.push("/post-job")}
              className="transform rounded-xl border-2 border-[#FF7003] bg-white px-8 py-4 text-lg font-semibold text-[#FF7003] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-[#FF7003] hover:text-white hover:shadow-2xl"
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
          className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                className="group rounded-2xl border border-gray-100 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FF7003]/20 hover:shadow-2xl"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-[#FF7003] to-[#FF8801] transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
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
          <p className="mb-6 text-sm text-gray-500">Trusted by the blockchain community</p>
          <div className="flex flex-col items-center justify-center space-y-4 text-gray-600 sm:flex-row sm:space-y-0 sm:space-x-12">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-green-500"></div>
              <span className="font-medium">Secure Smart Contracts</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-[#FF7003]"></div>
              <span className="font-medium">Stellar Network</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500"></div>
              <span className="font-medium">Decentralized Platform</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
