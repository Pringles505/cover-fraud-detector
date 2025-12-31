import styles from './ImageCard.module.css';

export function ImageCard({ image, onClick }) {
  return (
    <div className={styles.card} onClick={() => onClick(image)}>
      <img
        src={image.src}
        alt={image.name}
        className={styles.image}
        loading="lazy"
      />
      <div className={styles.overlay}>
        <p className={styles.name}>{image.name}</p>
      </div>
    </div>
  );
}
