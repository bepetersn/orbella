// Shared pure map math helpers.

export const lonLatTo3D = (lon, lat) => {
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;

  return {
    x: Math.cos(radLat) * Math.cos(radLon),
    y: Math.sin(radLat),
    z: Math.cos(radLat) * Math.sin(radLon),
  };
};
