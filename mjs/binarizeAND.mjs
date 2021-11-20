export const binarizeAND = lums => {
    for(const i of lums.keys()) lums[i] &= 0x80;
    return lums;
};
