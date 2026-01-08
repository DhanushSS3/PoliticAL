import { ManualInputType } from "@prisma/client";
export declare class ManualNewsIngestionDto {
    inputType: ManualInputType;
    textContent?: string;
    linkUrl?: string;
    title?: string;
}
