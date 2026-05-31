'use client';
import { useState, useEffect } from 'react';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

export function MatrixText({ 
  text, 
  delay = 0 
}: { 
  text: string; 
  delay?: number; 
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  useEffect(() => {
    if (!isMounted) return;

    let interval: NodeJS.Timeout;
    
    // Scramble effect during the delay
    const scrambleInterval = setInterval(() => {
      setDisplayText(
        text.split('').map(c => (c === ' ' || c === '.' ? c : chars[Math.floor(Math.random() * chars.length)])).join('')
      );
    }, 50);

    const startTimeout = setTimeout(() => {
      clearInterval(scrambleInterval);
      let iteration = 0;
      
      interval = setInterval(() => {
        setDisplayText(
          text
            .split('')
            .map((char, index) => {
              if (index < iteration || char === ' ' || char === '.') {
                return text[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('')
        );

        if (iteration >= text.length) {
          clearInterval(interval);
          setDisplayText(text); // Ensure exactly finishing
        }
        
        // Increase iteration pace
        iteration += 1 / 3; 
      }, 30);
    }, delay * 1000);

    return () => {
      clearTimeout(startTimeout);
      clearInterval(scrambleInterval);
      if (interval) clearInterval(interval);
    };
  }, [text, delay, isMounted]);

  if (!isMounted) {
    return <span className="opacity-0">{text}</span>;
  }

  return <span>{displayText}</span>;
}
