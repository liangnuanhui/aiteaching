-- Migration number: 0005 	 2025-11-23T05:59:43.524Z

-- Add visual_elements field to uploads table for detailed artwork analysis
-- Purpose: Store specific visual elements detected in artworks (e.g., animals, objects, characters)
ALTER TABLE uploads ADD COLUMN visual_elements TEXT;
