import { useEffect, useRef, useState } from 'react';
import CoursesSection from './components/CoursesSection';
import PartnershipsSection from './components/PartnershipsSection';
import TestimonialsSection from './components/TestimonialsSection';
import StatisticsSection from './components/StatisticsSection';
import AboutSection from './components/AboutSection';
import AwardsSection from './components/AwardsSection';
import InsightsSection from './components/InsightsSection';
import HeroSection from './components/HeroSection';
import CallbackButton from './components/CallbackButton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const HomePage = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [buttonTop, setButtonTop] = useState<string | number>('50%');

  const scrollCourses = (delta: number) => {
    const el = document.getElementById('courses-scroll');
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    const updateButtonTop = () => {
      const wrapper = wrapperRef.current;
      const scroller = document.getElementById('courses-scroll');
      if (!wrapper || !scroller) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const center = scrollerRect.top - wrapperRect.top + scrollerRect.height / 2;
      setButtonTop(center);
    };

    updateButtonTop();
    window.addEventListener('resize', updateButtonTop);
    window.addEventListener('scroll', updateButtonTop, { passive: true } as any);
    return () => {
      window.removeEventListener('resize', updateButtonTop);
      window.removeEventListener('scroll', updateButtonTop as any);
    };
  }, []);

  return (
    <>
      <HeroSection />

      {/* Courses section with external nav buttons */}
      <div ref={wrapperRef} className="relative max-w-7xl mx-auto">
        {/* Left external button */}
        <button
          aria-label="Scroll courses left"
          onClick={() => scrollCourses(-700)}
          className="hidden md:flex absolute left-8 z-20 h-16 w-16 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-200"
          style={{ top: buttonTop }}
        >
          <ChevronLeft className="h-8 w-8 text-white" />
        </button>

        <CoursesSection />

        {/* Right external button */}
        <button
          aria-label="Scroll courses right"
          onClick={() => scrollCourses(700)}
          className="hidden md:flex absolute right-8 z-20 h-16 w-16 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-200"
          style={{ top: buttonTop }}
        >
          <ChevronRight className="h-8 w-8 text-white" />
        </button>
      </div>

      <PartnershipsSection />
      <TestimonialsSection />
      <StatisticsSection />
      <AboutSection />
      <AwardsSection />
      <InsightsSection />
      <CallbackButton />
    </>
  );
};

export default HomePage;
