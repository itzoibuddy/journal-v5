'use client';

import { useEffect } from 'react';

export default function MobileMenuToggle() {
  useEffect(() => {
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (!mobileMenuButton || !mobileMenu) return;

    const handleMenuToggle = () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'true');
      } else {
        mobileMenu.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      }
    };

    const handleClickOutside = (event: Event) => {
      const target = event.target as Element;
      if (!mobileMenuButton.contains(target) && !mobileMenu.contains(target)) {
        mobileMenu.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      }
    };

    // Handle escape key
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
        // Return focus to the menu button
        (mobileMenuButton as HTMLElement).focus();
      }
    };

    mobileMenuButton.addEventListener('click', handleMenuToggle);
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup event listeners
    return () => {
      mobileMenuButton.removeEventListener('click', handleMenuToggle);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  return null; // This component doesn't render anything
} 