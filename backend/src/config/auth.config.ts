export default () => {
  const sessionDurationDays = parseInt(
    process.env.SESSION_DURATION_DAYS || "9",
    10,
  );

  return {
    auth: {
      secret: process.env.JWT_SECRET || "dev_secret",
      expiresIn: `${sessionDurationDays}d`,
    },
  };
};
