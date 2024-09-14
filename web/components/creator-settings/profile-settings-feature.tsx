'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useCrowdfundingProgram } from '../data-access/crowdfunding-data-access';
import DashboardLayout from '../dashboard/dashboard-layout';
import { useCreator } from '@/context/creator-context';
import { IconCameraFilled, IconPlus } from '@tabler/icons-react';
import { useRef, useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { z } from 'zod';
import { SocialLinkInput } from './social-link-input';
import { URL_REGEX } from '../utils/url.util';

export default function ProfileSettingsFeature() {
  return (
    <DashboardLayout>
      <ProfileForm />
    </DashboardLayout>
  );
}

// Define the Zod schema for validation
const profileFormSchema = z.object({
  imageUrl: z.string(),
  fullname: z
    .string()
    .min(3, 'Fullname must be at least 3 characters')
    .max(100, 'Fullname must be at most 100 characters'),
  bio: z.string().max(250, 'Description must be at most 250 characters'),
  socialLinks: z
    .array(
      z
        .string()
        .max(250, 'Each link must be at most 250 characters')
        .regex(URL_REGEX, 'Each link must be a valid URL'),
    )
    .max(5, 'You can have at most 5 social links'),
});

// Define TypeScript type based on Zod schema
type ProfileFormData = z.infer<typeof profileFormSchema>;

const initialData: ProfileFormData = {
  imageUrl: '',
  fullname: '',
  bio: '',
  socialLinks: [],
};

const initialErrors = {
  fullname: '',
  bio: '',
  socialLinks: '',
};

function ProfileForm() {
  const { publicKey } = useWallet();
  const { creator } = useCreator();

  const { updateCreatorProfile } = useCrowdfundingProgram();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [formData, setFormData] = useState<ProfileFormData>(initialData);
  const [errors, setErrors] = useState<typeof initialErrors>(initialErrors);

  useEffect(() => {
    if (creator) {
      setFormData((prevState) => ({
        ...prevState,
        imageUrl: creator.imageUrl,
        fullname: creator.fullname,
        bio: creator.bio,
        socialLinks: creator.socialLinks,
      }));
    }
  }, [creator]);

  const handleDivClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);

    // Preview the image
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreview(objectUrl);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!publicKey) {
      alert('Please connect your wallet');
      return;
    }

    // Clear previous errors
    setErrors(initialErrors);

    // Validate the update profile form fields
    const validationResult = profileFormSchema.safeParse(formData);

    if (validationResult.error) {
      const fieldErrors = validationResult.error.formErrors.fieldErrors;

      setErrors({
        fullname: fieldErrors.fullname?.[0] || '',
        bio: fieldErrors.bio?.[0] || '',
        socialLinks: fieldErrors.socialLinks?.[0] || '',
      });

      return;
    }

    await updateCreatorProfile.mutateAsync({
      imageUrl: formData.imageUrl,
      fullname: formData.fullname,
      bio: formData.bio,
      socialLinks: formData.socialLinks,
      owner: publicKey,
    });
  };

  const handleAddSocialLink = () => {
    setFormData((prevState) => ({
      ...prevState,
      socialLinks: [...prevState.socialLinks, ''],
    }));
  };

  const handleSocialLinkChange = (index: number, value: string) => {
    const newSocialLinks = [...formData.socialLinks];
    newSocialLinks[index] = value;
    setFormData((prevState) => ({
      ...prevState,
      socialLinks: newSocialLinks,
    }));
  };

  const handleRemoveSocialLink = (index: number) => {
    const newSocialLinks = formData.socialLinks.filter((_, i) => i !== index);
    setFormData((prevState) => ({
      ...prevState,
      socialLinks: newSocialLinks,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-box bg-white p-4">
      <div className="divide-y divide-gray-200">
        <div className="py-6">
          <div
            className="relative flex h-20 w-20 cursor-pointer items-center justify-center"
            onClick={handleDivClick}
          >
            <div className="absolute z-10 h-full w-full rounded-full bg-black opacity-40"></div>
            <IconCameraFilled size={24} className="absolute z-20 text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              hidden
            />
            {preview && (
              <img
                src={preview}
                alt="Selected file"
                className="absolute h-20 w-20 rounded-full object-cover"
              />
            )}
          </div>
        </div>
        <div className="py-6">
          <label htmlFor="fullname" className="font-bold">
            Full name
          </label>
          <input
            type="text"
            id="fullname"
            name="fullname"
            value={formData.fullname}
            placeholder="John Smith"
            className="input mt-2 w-full border-2 bg-gray-100 focus:border-slate-900 focus:bg-white focus:outline-none"
            required
            onChange={(e) =>
              setFormData({
                ...formData,
                fullname: e.target.value,
              })
            }
          />
          {errors.fullname && (
            <p className="text-sm text-red-600">{errors.fullname}</p>
          )}
        </div>
        <div className="py-6">
          <label htmlFor="bio" className="font-bold">
            What are you creating?
          </label>
          <textarea
            id="bio"
            name="bio"
            className="textarea textarea-md mt-2 w-full border-2 bg-gray-100 text-base focus:border-slate-900 focus:bg-white focus:outline-none"
            placeholder="Blockchain Developer and coffee lover"
            value={formData.bio}
            onChange={(e) =>
              setFormData({
                ...formData,
                bio: e.target.value,
              })
            }
          ></textarea>
          {errors.bio && <p className="text-sm text-red-600">{errors.bio}</p>}
        </div>
        <div className="py-6">
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold">Social links</label>
            <button
              type="button"
              onClick={handleAddSocialLink}
              className="btn btn-sm rounded-full"
              disabled={formData.socialLinks.length >= 5}
            >
              <IconPlus />
              Add social link
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {formData.socialLinks.map((link, index) => (
              <SocialLinkInput
                key={index}
                link={link}
                index={index}
                onChange={handleSocialLinkChange}
                onRemove={handleRemoveSocialLink}
              />
            ))}
            {formData.socialLinks.length === 0 && (
              <p className="text-sm text-gray-500">
                You have no social links added yet, but you can add up to 5.
              </p>
            )}
          </div>
          {errors.socialLinks && (
            <p className="text-sm text-red-600">{errors.socialLinks}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-md rounded-full bg-purple-800 text-white outline-none hover:bg-purple-700"
        disabled={updateCreatorProfile.isPending}
      >
        {updateCreatorProfile.isPending && (
          <span className="loading loading-spinner"></span>
        )}
        Save changes
      </button>
    </form>
  );
}