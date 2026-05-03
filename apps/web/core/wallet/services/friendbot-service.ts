import { fundWithFriendbot } from "@/core/wallet/lib/friendbot";

import type { IWalletFriendbotService, TFriendbotResponse } from "@/core/wallet/types";

export class FriendbotService implements IWalletFriendbotService {
  public async fundAccount(address: string): Promise<TFriendbotResponse> {
    return fundWithFriendbot(address);
  }
}