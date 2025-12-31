import { ImageCard } from '../ImageCard/ImageCard';
import styles from './ImageGrid.module.css';

export function ImageGrid({ images, onImageClick }) {
  return (
    <div className={styles.grid}>
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          onClick={onImageClick}
        />
      ))}
    </div>
  );
}
