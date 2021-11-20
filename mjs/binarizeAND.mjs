export const binarizeAND = luminance => {
    for(const i of lums.keys()) luminance[i] &= 0x80;
    return luminance;
};
