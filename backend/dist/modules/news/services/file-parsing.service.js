"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FileParsingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParsingService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const FormData = require("form-data");
let FileParsingService = FileParsingService_1 = class FileParsingService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(FileParsingService_1.name);
        this.analysisServiceUrl = this.configService.get('ANALYSIS_SERVICE_URL') || 'http://localhost:8000';
    }
    async parseFile(fileBuffer, filename) {
        try {
            const formData = new FormData();
            formData.append('file', fileBuffer, filename);
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.analysisServiceUrl}/parse/file`, formData, {
                headers: Object.assign({}, formData.getHeaders()),
            }));
            return data.extracted_text;
        }
        catch (error) {
            this.logger.error(`File parsing failed for ${filename}: ${error.message}`);
            throw new Error(`Failed to extract text from file: ${error.message}`);
        }
    }
};
exports.FileParsingService = FileParsingService;
exports.FileParsingService = FileParsingService = FileParsingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], FileParsingService);
//# sourceMappingURL=file-parsing.service.js.map