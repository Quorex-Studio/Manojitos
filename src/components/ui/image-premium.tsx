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
        <div className={cn("relative overflow-hidden bg-secondary/20", aspectRatioClass, wrapperClassName)}>
            {!isLoaded && !hasError && (
                <Skeleton className="absolute inset-0 w-full h-full animate-pulse z-10" />
            )}

            <img
                src={src}
                alt={alt || "Imagen de producto"}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
                className={cn(
                    "w-full h-full object-cover transition-all duration-700 ease-in-out",
                    !isLoaded ? "scale-110 blur-xl opacity-0" : "scale-100 blur-0 opacity-100",
                    className
                )}
                {...props}
            />

            {/* Fallback en caso de error */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 text-muted-foreground p-4 text-center text-sm">
                    <span>Imagen no disponible</span>
                </div>
            )}
        </div>
    );
}
