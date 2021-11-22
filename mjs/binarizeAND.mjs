export const binarizeAND = luminance => {
    for(const i of luminance.keys()) luminance[i] &= 0x80;
    return luminance;
};
