import { Metadata, ResolvingMetadata } from 'next';
import { prisma } from '@/lib/db';

type Props = {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const defaultMeta = {
    title: 'Content | Verixa',
    description: 'View decentralized content on Verixa',
  };

  try {
    const contentId = BigInt(params.id);
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) return defaultMeta;

    const title = `${content.title} | Verixa`;
    const description = content.description || defaultMeta.description;
    const images = content.previewCid ? [content.previewCid] : [];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images,
      },
    };
  } catch (error) {
    return defaultMeta;
  }
}

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
