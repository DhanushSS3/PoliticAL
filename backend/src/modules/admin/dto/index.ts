export class CreateSubscriptionDto {
  isTrial: boolean;
  startsAt: Date;
  endsAt?: Date;
  geoUnitIds?: number[]; // Optional: Geo units to grant access to
}

export class GrantGeoAccessDto {
  geoUnitIds: number[];
}

export class UpdateUserDto {
  fullName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}
