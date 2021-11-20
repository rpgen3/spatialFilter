export const toReverse = data => {
    for(const [i, v] of data.entries()) data[i] = 255 - v;
    return data;
};
