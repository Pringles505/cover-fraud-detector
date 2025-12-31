import { useModal } from '../../hooks/useModal';
import { ImageGrid } from '../ImageGrid/ImageGrid';
import { Modal } from '../Modal/Modal';
import styles from './App.module.css';

function App() {
  const { isOpen, selectedImage, openModal, closeModal } = useModal();

  // Dynamically load all images from public/covers folder
  const coverModules = import.meta.glob('/public/covers/*.(jpg|jpeg|png|svg|webp|gif)', { eager: true, query: '?url', import: 'default' });

  const images = Object.entries(coverModules).map(([path, url], index) => {
    // Extract filename without extension for the name
    const filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
    const displayName = filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());

    return {
      id: index + 1,
      name: displayName,
      src: url
    };
  });

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cover Gallery</h1>
        <p className={styles.subtitle}>Click on any cover to view it up close</p>
      </header>

      <main>
        <ImageGrid images={images} onImageClick={openModal} />
      </main>

      <Modal isOpen={isOpen} image={selectedImage} onClose={closeModal} />
    </div>
  );
}

export default App;
