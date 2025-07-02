if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  ['log', 'debug', 'info', 'warn'].forEach(method => {
    // @ts-ignore
    console[method] = () => {};
  });
} 