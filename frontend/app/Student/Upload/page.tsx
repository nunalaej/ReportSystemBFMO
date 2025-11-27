"use client";

import { CldImage, CldUploadButton } from "next-cloudinary";
import { useState } from "react";

export default function Page() {
  const [publicId, setPublicId] = useState<string | null>(null);

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1>Test Cloudinary upload</h1>

      <CldUploadButton
        uploadPreset="YOUR_UNSIGNED_PRESET"
        onUpload={(result: any) => {
          // For unsigned uploads, Cloudinary returns info here
          setPublicId(result.info.public_id);
          console.log(result.info);
        }}
      >
        Upload image
      </CldUploadButton>

      {publicId && (
        <div style={{ marginTop: "1rem" }}>
          <CldImage
            src={publicId}
            width={500}
            height={500}
            alt="Uploaded image"
          />
        </div>
      )}
    </div>
  );
}
