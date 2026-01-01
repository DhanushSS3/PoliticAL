"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    auth: {
        secret: process.env.JWT_SECRET || "dev_secret",
        expiresIn: "7d",
    },
});
//# sourceMappingURL=auth.config.js.map