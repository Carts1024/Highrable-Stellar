import { STELLAR_HORIZON_URL } from "@/core/config/web3";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";

import type { IWalletFundingService, TWalletFundingStatus } from "@/core/wallet/types";

function toHorizonAccountUrl(address: string): string {
  return `${STELLAR_HORIZON_URL}/accounts/${encodeURIComponent(address)}`;
}

export class HorizonAccountService implements IWalletFundingService {
  public async getFundingStatus(address: string): Promise<TWalletFundingStatus> {
    const sanitizedAddress = TStellarPublicKeySchema.parse(address);
    const response = await fetch(toHorizonAccountUrl(sanitizedAddress), {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 404) {
      return {
        address: sanitizedAddress,
        isFunded: false,
      };
    }

    if (!response.ok) {
      throw new Error(`Failed to check Horizon funding status (${response.status}).`);
    }

    return {
      address: sanitizedAddress,
      isFunded: true,
    };
  }
}
