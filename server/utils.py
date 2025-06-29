def convert_to_milvus_sparse_format(sparse_vectors):
    if not sparse_vectors:
        return None
    milvus_sparse_vectors = []
    for vector in sparse_vectors:
        sparse_dict = {i: val for i, val in enumerate(vector) if val != 0.0}
        milvus_sparse_vectors.append(sparse_dict)
    return milvus_sparse_vectors