import React from 'react';
import { Hero } from '../components/Home/Hero';
import { HowItWorksSection } from '../components/Home/HowItWorksSection';
import { Footer } from '../components/Layout/Footer';

export const Home: React.FC = () => {
  return (
    <>
      <Hero />
      <HowItWorksSection />
      <Footer />
    </>
  );
};