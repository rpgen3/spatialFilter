export const toOpacity = data => {
    for(let i = 3; i < data.length; i += 4) data[i] = 255;
    return data;
};
