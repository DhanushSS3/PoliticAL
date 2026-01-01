export default () => ({
  auth: {
    secret: process.env.JWT_SECRET || "dev_secret",
    expiresIn: "7d",
  },
});
