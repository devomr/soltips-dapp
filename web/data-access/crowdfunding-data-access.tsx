'use client';

import {
  CROWDFUNDING_PROGRAM_ID,
  getCrowdfundingProgram,
} from '@soltips/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { BN } from '@coral-xyz/anchor';
import { useCluster } from '@/components/cluster/cluster-data-access';
import { useAnchorProvider } from '@/components/solana/solana-provider';
import { useTransactionToast } from '@/components/ui/ui-layout';

export type Creator = {
  owner: PublicKey;
  username: string;
  fullname: string;
  bio: string;
  imageUrl: string;
  socialLinks: string[];
  isSupportersCountVisible: boolean;
  pricePerDonation: BN;
  donationItem: string;
  themeColor: string;
  supportersCount: BN;
  campaignsCount: BN;
  supporterDonationsAmount: BN;
  thanksMessage: string;
};

export type SupporterDonation = {
  supporter: PublicKey;
  name: string;
  message: string;
  amount: number;
  fees: number;
  item: string;
  quantity: number;
  price: number;
  timestamp: BN;
};

export type Campaign = {
  id: BN;
  owner: PublicKey;
  name: string;
  description: string;
  isTargetAmountVisible: boolean;
  targetAmount: BN;
  amountDonated: BN;
  amountWithdrawn: BN;
};

interface RegisterCreatorInput {
  owner: PublicKey;
  username: string;
  fullname: string;
  bio: string;
}

interface UpdateCreatorProfileInput {
  owner: PublicKey;
  fullname: string;
  bio: string;
  imageUrl: string;
  socialLinks: string[];
}

interface UpdateCreatorPageInput {
  owner: PublicKey;
  isSupportersCountVisible: boolean;
  pricePerDonation: number;
  donationItem: string;
  themeColor: string;
  thanksMessage: string;
}

interface SaveSupporterDonationInput {
  name: string;
  message: string;
  quantity: number;
  creator: Creator;
}

interface CreateCampaignInput {
  name: string;
  description: string;
  amount: number;
  isTargetAmountVisible: boolean;
  address: PublicKey;
}

interface MakeCampaignDonationInput {
  id: string;
  message: string;
  amount: number;
  address: PublicKey;
  campaignId: BN;
}

interface WithdrawCampaignFundsInput {
  amount: number;
  address: PublicKey;
  campaignId: BN;
}

export function useCrowdfundingProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const provider = useAnchorProvider();
  const program = getCrowdfundingProgram(provider);
  const client = useQueryClient();
  const { publicKey } = useWallet();

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(CROWDFUNDING_PROGRAM_ID),
  });

  const accounts = useQuery({
    queryKey: ['crowdfunding', 'all', { cluster }],
    queryFn: () => program.account.creator.all(),
  });

  const checkUsername = (username: string) => {
    return useQuery({
      queryKey: ['crowdfunding', 'check-username', { cluster, username }],
      queryFn: async () => {
        const usernamePda = getUsernamePda(username);
        return program.account.creatorUsername.fetchNullable(usernamePda);
      },
    });
  };

  const getCreatorByAddress = (address: PublicKey | null) => {
    return useQuery({
      queryKey: [
        'crowdfunding',
        'get-creator-by-address',
        { cluster, address },
      ],
      queryFn: () => {
        if (!address) {
          return null;
        }

        const creatorPda = getCreatorPda(address);
        return program.account.creator.fetchNullable(creatorPda);
      },
    });
  };

  const getCreatorByUsername = (username: string) => {
    const { data: usernameRecord } = checkUsername(username);

    return useQuery({
      queryKey: [
        'crowdfunding',
        'get-creator-by-username',
        { cluster, username },
      ],
      queryFn: () => {
        if (!usernameRecord) {
          return null;
        }
        const creatorPda = getCreatorPda(usernameRecord.owner);
        return program.account.creator.fetchNullable(creatorPda);
      },
      enabled: !!usernameRecord,
    });
  };

  const listSupporterDonations = (username: string) => {
    const { data: usernameRecord } = checkUsername(username);

    return useQuery({
      queryKey: [
        'crowdfunding',
        'list-supporter-donations',
        { cluster, username },
      ],
      queryFn: async () => {
        if (!usernameRecord) {
          return [];
        }

        const creatorPda = getCreatorPda(usernameRecord.owner);
        const creator = await program.account.creator.fetchNullable(creatorPda);

        if (!creator) {
          return [];
        }

        const results = [];

        for (let idx = creator.supportersCount - 1; idx >= 0; idx--) {
          const supporterDonationPda = getSupporterDonationPda(
            creatorPda,
            new BN(idx),
          );
          const supporterDonation =
            await program.account.supporterDonation.fetchNullable(
              supporterDonationPda,
            );

          if (supporterDonation) {
            results.push(supporterDonation);
          }
        }
        return results;
      },
      enabled: !!usernameRecord,
    });
  };

  const getCampaign = (address: PublicKey, id: string | null) => {
    return useQuery({
      queryKey: ['crowdfunding', 'get-campaign', { cluster, address, id }],
      queryFn: async () => {
        if (!address || !id) {
          return null;
        }

        const creatorPda = getCreatorPda(address);
        const creator = await program.account.creator.fetchNullable(creatorPda);

        if (!creator) {
          return null;
        }
        const campaignPda = getCampaignPda(creatorPda, new BN(id));
        const campaign =
          await program.account.campaign.fetchNullable(campaignPda);

        return campaign;
      },
    });
  };

  const listCampaigns = (address: PublicKey) => {
    return useQuery({
      queryKey: ['crowdfunding', 'list-campaigns', { cluster, address }],
      queryFn: async () => {
        if (!address) {
          return [];
        }

        const creatorPda = getCreatorPda(address);
        const creator = await program.account.creator.fetchNullable(creatorPda);

        if (!creator) {
          return [];
        }

        const results = [];

        for (let idx = creator.campaignsCount - 1; idx >= 0; idx--) {
          const campaignPda = getCampaignPda(creatorPda, new BN(idx));
          const campaign =
            await program.account.campaign.fetchNullable(campaignPda);

          if (campaign) {
            results.push(campaign);
          }
        }
        return results;
      },
    });
  };

  const registerCreator = useMutation<string, Error, RegisterCreatorInput>({
    mutationKey: ['crowdfunding', 'register-creator', { cluster }],
    mutationFn: async ({ username, fullname, bio, owner }) => {
      const creatorPda = getCreatorPda(owner);
      const usernamePda = getUsernamePda(username);

      const accounts = {
        creator: creatorPda,
        owner: owner,
        usernameAccount: usernamePda,
      };

      return program.methods
        .registerCreator(username, fullname, bio)
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const updateCreatorProfile = useMutation<
    string,
    Error,
    UpdateCreatorProfileInput
  >({
    mutationKey: ['crowdfunding', 'update-creator-profile', { cluster }],
    mutationFn: async ({ fullname, bio, imageUrl, socialLinks, owner }) => {
      const creatorPda = getCreatorPda(owner);

      const accounts = {
        creatorAccount: creatorPda,
      };

      return program.methods
        .updateCreatorProfile(fullname, bio, imageUrl, socialLinks)
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const updateCreatorPage = useMutation<string, Error, UpdateCreatorPageInput>({
    mutationKey: ['crowdfunding', 'update-creator-page', { cluster }],
    mutationFn: async ({
      isSupportersCountVisible,
      pricePerDonation,
      donationItem,
      themeColor,
      thanksMessage,
      owner,
    }) => {
      const creatorPda = getCreatorPda(owner);

      const accounts = {
        creatorAccount: creatorPda,
      };

      return program.methods
        .updateCreatorPage(
          isSupportersCountVisible,
          new BN(pricePerDonation),
          donationItem,
          themeColor,
          thanksMessage,
        )
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const saveSupporterDonation = useMutation<
    string,
    Error,
    SaveSupporterDonationInput
  >({
    mutationKey: ['crowdfunding', 'save-supporter-donation', { cluster }],
    mutationFn: async ({ name, message, quantity, creator }) => {
      const creatorPda = getCreatorPda(creator.owner);
      const creatorAccount = await program.account.creator.fetch(creatorPda);
      const supporterDonationPda = getSupporterDonationPda(
        creatorPda,
        creatorAccount.supportersCount,
      );

      const feeCollectorPublicKey =
        process.env.NEXT_PUBLIC_FEE_COLLECTOR_PUBLIC_KEY ?? '';

      const accounts = {
        creatorAccount: creatorPda,
        supporterDonationAccount: supporterDonationPda,
        receiver: creator.owner,
        feeCollector: new PublicKey(feeCollectorPublicKey),
      };

      return program.methods
        .sendSupporterDonation(name, message, quantity)
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature, input) => {
      transactionToast(signature);

      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint, address: publicKey },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'get-creator-by-username',
            { cluster, username: input.creator.username },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'list-supporter-donations',
            { cluster, username: input.creator.username },
          ],
        }),
      ]);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const createCampaign = useMutation<string, Error, CreateCampaignInput>({
    mutationKey: ['crowdfunding', 'create-campaign', { cluster }],
    mutationFn: async ({
      name,
      description,
      amount,
      isTargetAmountVisible,
      address,
    }) => {
      const creatorPda = getCreatorPda(address);
      const creatorAccount = await program.account.creator.fetch(creatorPda);
      const campaignPda = getCampaignPda(
        creatorPda,
        creatorAccount.campaignsCount,
      );

      const accounts = {
        creatorAccount: creatorPda,
        campaignAccount: campaignPda,
      };

      return program.methods
        .createCampaign(
          name,
          description,
          new BN(amount),
          isTargetAmountVisible,
        )
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature, input) => {
      transactionToast(signature);

      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint, address: publicKey },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'list-campaigns',
            { cluster, address: input.address },
          ],
        }),
      ]);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const makeCampaignDonation = useMutation<
    string,
    Error,
    MakeCampaignDonationInput
  >({
    mutationKey: ['crowdfunding', 'make-campaign-donation', { cluster }],
    mutationFn: async ({ message, amount, address, campaignId }) => {
      const creatorPda = getCreatorPda(address);
      const campaignPda = getCampaignPda(creatorPda, campaignId);

      const accounts = {
        campaignAccount: campaignPda,
      };

      return program.methods
        .makeCampaignDonation(new BN(amount))
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature, input) => {
      transactionToast(signature);

      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint, address: publicKey },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'list-campaigns',
            { cluster, address: input.address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'get-campaign',
            { cluster, address: input.address, id: input.id },
          ],
        }),
      ]);
    },
    onError: () => toast.error('Failed to run program'),
  });

  const withdrawCampaignFunds = useMutation<
    string,
    Error,
    WithdrawCampaignFundsInput
  >({
    mutationKey: ['crowdfunding', 'withdraw-campaign-funds', { cluster }],
    mutationFn: async ({ amount, address, campaignId }) => {
      const creatorPda = getCreatorPda(address);
      const campaignPda = getCampaignPda(creatorPda, campaignId);

      const accounts = {
        campaignAccount: campaignPda,
      };

      return program.methods
        .withdrawCampaignFunds(new BN(amount))
        .accounts({ ...accounts })
        .rpc();
    },
    onSuccess: (signature, input) => {
      transactionToast(signature);

      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            'get-balance',
            { endpoint: connection.rpcEndpoint, address: publicKey },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            'crowdfunding',
            'list-campaigns',
            { cluster, address: input.address },
          ],
        }),
      ]);
    },
    onError: () => toast.error('Failed to run program'),
  });

  return {
    program,
    CROWDFUNDING_PROGRAM_ID,
    getProgramAccount,
    accounts,
    checkUsername,
    getCreatorByAddress,
    getCreatorByUsername,
    listSupporterDonations,
    getCampaign,
    listCampaigns,
    registerCreator,
    updateCreatorProfile,
    updateCreatorPage,
    saveSupporterDonation,
    createCampaign,
    makeCampaignDonation,
    withdrawCampaignFunds,
  };
}

const getUsernamePda = (username: string) => {
  const [usernamePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('username'), Buffer.from(username)],
    CROWDFUNDING_PROGRAM_ID,
  );

  return usernamePda;
};

const getCreatorPda = (address: PublicKey) => {
  const [creatorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator'), address.toBuffer()],
    CROWDFUNDING_PROGRAM_ID,
  );
  return creatorPda;
};

const getSupporterDonationPda = (
  creatorPda: PublicKey,
  supportersCount: BN,
) => {
  const [supporterDonationPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('supporterDonation'),
      creatorPda.toBuffer(),
      supportersCount.toArrayLike(Buffer, 'le', 8),
    ],
    CROWDFUNDING_PROGRAM_ID,
  );

  return supporterDonationPda;
};

const getCampaignPda = (creatorPda: PublicKey, campaignsCount: BN) => {
  const [campaignPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('campaign'),
      creatorPda.toBuffer(),
      campaignsCount.toArrayLike(Buffer, 'le', 8),
    ],
    CROWDFUNDING_PROGRAM_ID,
  );

  return campaignPda;
};