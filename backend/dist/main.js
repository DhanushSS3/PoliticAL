"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const constants_1 = require("./common/constants/constants");
const app_module_1 = require("./app.module");
const cookieParser = require("cookie-parser");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const logger = new common_1.Logger('HTTP');
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.use(cookieParser());
    app.use((req, res, next) => {
        const { method, originalUrl } = req;
        const userAgent = req.get('user-agent') || '';
        logger.log(`${method} ${originalUrl} - ${userAgent}`);
        next();
    });
    app.setGlobalPrefix(constants_1.Constants.API_PREFIX);
    await app.listen(process.env.PORT || 3000);
    logger.log(`Application is running on: http://localhost:${process.env.PORT || 3000}`);
}
bootstrap();
//# sourceMappingURL=main.js.map