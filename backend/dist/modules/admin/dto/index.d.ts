export declare class CreateSubscriptionDto {
    isTrial: boolean;
    startsAt: Date;
    endsAt?: Date;
    geoUnitIds?: number[];
}
export declare class GrantGeoAccessDto {
    geoUnitIds: number[];
}
export declare class UpdateUserDto {
    fullName?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
}
