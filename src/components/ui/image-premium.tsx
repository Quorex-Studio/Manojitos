import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ImagePremiumProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    wrapperClassName?: string;
    aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

export function ImagePremium({
    className,
    wrapperClassName,
    alt,
    src,
    aspectRatio = 'auto',
    ...props
}: ImagePremiumProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const aspectRatioClass = {
        square: 'aspect-square',
        video: 'aspect-video',
        portrait: 'aspect-[3/4]',
        auto: '',
    }[aspectRatio];

    return (
        <div className={cn("relative overflow-hidden bg-secondary", aspectRatioClass, wrapperClassName)}>
            {!isLoaded && !hasError && (
                <Skeleton className="absolute inset-0 w-full h-full z-10 rounded-none" />
            )}

            <img
                src={src}
                alt={alt || "Imagen de producto"}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-500 ease-in-out",
                    !isLoaded ? "opacity-0" : "opacity-100",
                    className
                )}
                {...props}
            />

            {/* Fallback en caso de error */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 text-muted-foreground p-4 text-center text-sm">
                    <span>Imagen no disponible</span>
                </div>
            )}
        </div>
    );
}
